package com.paylite.app

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class SmsUploadWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

    companion object {
        private const val TAG = "PayliteWorker"
        private const val PREFS_NAME = "paylite_native"
        private const val KEY_QUEUE = "sms_queue"
        private const val KEY_DEVICE_KEY = "device_key"
        private const val KEY_TOKEN = "access_token"
        private const val KEY_SENT_IDS = "sent_ids"
        private const val BASE_URL = "https://api.nihalhub.store"
        private const val TIMEOUT_MS = 12000
        private const val MAX_SENT_IDS = 2000

        fun getPrefs(context: Context): SharedPreferences {
            return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        }

        fun enqueueSms(context: Context, sender: String, message: String, provider: String, trxId: String, amountPaisa: Long) {
            val prefs = getPrefs(context)

            val sentIds = getSentIds(prefs)
            val dedupeKey = "${provider}_${trxId}_${amountPaisa}"
            if (sentIds.contains(dedupeKey)) {
                Log.d(TAG, "Duplicate detected in native layer: $dedupeKey")
                return
            }

            val queue = getQueue(prefs)
            for (i in 0 until queue.length()) {
                val item = queue.optJSONObject(i) ?: continue
                val existingKey = "${item.optString("provider")}_${item.optString("trx_id")}_${item.optLong("amount_paisa")}"
                if (existingKey == dedupeKey) {
                    Log.d(TAG, "Already in queue: $dedupeKey")
                    return
                }
            }

            val item = JSONObject().apply {
                put("provider", provider)
                put("sender", sender)
                put("message", message.take(1000))
                put("amount_paisa", amountPaisa)
                put("trx_id", trxId)
                put("timestamp", System.currentTimeMillis())
            }
            queue.put(item)

            prefs.edit().putString(KEY_QUEUE, queue.toString()).apply()

            Log.d(TAG, "SMS enqueued natively: $provider $trxId amount=$amountPaisa (queue=${queue.length()})")
        }

        fun getQueue(prefs: SharedPreferences): JSONArray {
            val raw = prefs.getString(KEY_QUEUE, "[]") ?: "[]"
            return try { JSONArray(raw) } catch (e: Exception) { JSONArray() }
        }

        fun getQueueCount(context: Context): Int {
            return getQueue(getPrefs(context)).length()
        }

        private fun getSentIds(prefs: SharedPreferences): Set<String> {
            return prefs.getStringSet(KEY_SENT_IDS, emptySet()) ?: emptySet()
        }

        private fun addSentId(prefs: SharedPreferences, dedupeKey: String) {
            val existing = getSentIds(prefs).toMutableSet()
            existing.add(dedupeKey)
            if (existing.size > MAX_SENT_IDS) {
                val trimmed = existing.toList().takeLast(MAX_SENT_IDS / 2).toMutableSet()
                prefs.edit().putStringSet(KEY_SENT_IDS, trimmed).apply()
            } else {
                prefs.edit().putStringSet(KEY_SENT_IDS, existing).apply()
            }
        }
    }

    override fun doWork(): Result {
        val prefs = getPrefs(applicationContext)
        val queue = getQueue(prefs)

        if (queue.length() == 0) {
            Log.d(TAG, "Queue empty, nothing to upload")
            return Result.success()
        }

        Log.d(TAG, "Processing ${queue.length()} items from native queue")

        val deviceKey = prefs.getString(KEY_DEVICE_KEY, null)
        if (deviceKey.isNullOrBlank()) {
            Log.w(TAG, "No device key in native storage, will retry when app provides key")
            return Result.retry()
        }

        var token = prefs.getString(KEY_TOKEN, null)
        if (token.isNullOrBlank()) {
            token = doLogin(deviceKey, prefs)
            if (token == null) {
                Log.w(TAG, "Login failed, will retry later")
                return Result.retry()
            }
        }

        val remaining = JSONArray()
        var anySuccess = false
        var authFailed = false

        for (i in 0 until queue.length()) {
            val item = queue.optJSONObject(i) ?: continue

            if (authFailed) {
                remaining.put(item)
                continue
            }

            val dedupeKey = "${item.optString("provider")}_${item.optString("trx_id")}_${item.optLong("amount_paisa")}"
            if (getSentIds(prefs).contains(dedupeKey)) {
                Log.d(TAG, "Skipping already-sent item: $dedupeKey")
                continue
            }

            val result = uploadSms(item, token!!)

            when (result) {
                UploadResult.SUCCESS -> {
                    addSentId(prefs, dedupeKey)
                    anySuccess = true
                    Log.d(TAG, "Uploaded: ${item.optString("provider")} ${item.optString("trx_id")}")
                }
                UploadResult.AUTH_FAILED -> {
                    token = doLogin(deviceKey, prefs)
                    if (token != null) {
                        val retry = uploadSms(item, token)
                        if (retry == UploadResult.SUCCESS) {
                            addSentId(prefs, dedupeKey)
                            anySuccess = true
                        } else {
                            remaining.put(item)
                            if (retry == UploadResult.AUTH_FAILED) authFailed = true
                        }
                    } else {
                        remaining.put(item)
                        authFailed = true
                    }
                }
                UploadResult.DUPLICATE -> {
                    addSentId(prefs, dedupeKey)
                    Log.d(TAG, "Server reported duplicate: $dedupeKey")
                }
                UploadResult.NETWORK_ERROR -> {
                    remaining.put(item)
                    for (j in (i + 1) until queue.length()) {
                        queue.optJSONObject(j)?.let { remaining.put(it) }
                    }
                    prefs.edit().putString(KEY_QUEUE, remaining.toString()).apply()
                    Log.d(TAG, "Network error, ${remaining.length()} items remaining, will retry")
                    return Result.retry()
                }
                UploadResult.SERVER_ERROR -> {
                    remaining.put(item)
                }
            }
        }

        prefs.edit().putString(KEY_QUEUE, remaining.toString()).apply()

        if (remaining.length() > 0) {
            Log.d(TAG, "Done batch. ${remaining.length()} items remaining in queue, will retry")
            return Result.retry()
        }

        Log.d(TAG, "All ${queue.length()} items uploaded successfully")
        return Result.success()
    }

    private fun doLogin(deviceKey: String, prefs: SharedPreferences): String? {
        try {
            val url = URL("$BASE_URL/api/v1/auth/login")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.connectTimeout = TIMEOUT_MS
            conn.readTimeout = TIMEOUT_MS
            conn.doOutput = true

            val body = JSONObject().put("device_key", deviceKey).toString()
            conn.outputStream.use { os ->
                os.write(body.toByteArray(Charsets.UTF_8))
            }

            val code = conn.responseCode
            if (code == 200) {
                val response = conn.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(response)
                val token = json.optString("access_token", "")
                if (token.isNotBlank()) {
                    prefs.edit().putString(KEY_TOKEN, token).apply()
                    Log.d(TAG, "Native login successful, token saved")
                    return token
                }
            } else {
                Log.w(TAG, "Native login failed with status $code")
            }
            conn.disconnect()
        } catch (e: Exception) {
            Log.e(TAG, "Native login error", e)
        }
        return null
    }

    private fun uploadSms(item: JSONObject, token: String): UploadResult {
        try {
            val url = URL("$BASE_URL/api/v1/sms")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.connectTimeout = TIMEOUT_MS
            conn.readTimeout = TIMEOUT_MS
            conn.doOutput = true

            val body = JSONObject().apply {
                put("provider", item.optString("provider"))
                put("sender", item.optString("sender"))
                put("message", item.optString("message"))
                put("amount_paisa", item.optLong("amount_paisa"))
                put("trx_id", item.optString("trx_id"))
            }.toString()

            conn.outputStream.use { os ->
                os.write(body.toByteArray(Charsets.UTF_8))
            }

            val code = conn.responseCode
            conn.disconnect()

            return when {
                code in 200..299 -> UploadResult.SUCCESS
                code == 401 -> UploadResult.AUTH_FAILED
                code == 409 -> UploadResult.DUPLICATE
                code in 500..599 -> UploadResult.SERVER_ERROR
                else -> UploadResult.SERVER_ERROR
            }
        } catch (e: java.net.UnknownHostException) {
            return UploadResult.NETWORK_ERROR
        } catch (e: java.net.ConnectException) {
            return UploadResult.NETWORK_ERROR
        } catch (e: java.net.SocketTimeoutException) {
            return UploadResult.NETWORK_ERROR
        } catch (e: java.io.IOException) {
            return UploadResult.NETWORK_ERROR
        } catch (e: Exception) {
            Log.e(TAG, "Upload error", e)
            return UploadResult.NETWORK_ERROR
        }
    }

    private enum class UploadResult {
        SUCCESS, AUTH_FAILED, NETWORK_ERROR, SERVER_ERROR, DUPLICATE
    }
}
