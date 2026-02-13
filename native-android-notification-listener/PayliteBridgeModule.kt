package com.paylite.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.util.Log
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray

class PayliteBridgeModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private var receiver: BroadcastReceiver? = null
    private var listenerCount = 0

    companion object {
        private const val TAG = "PayliteBridge"
        private const val PREFS_NAME = "paylite_native"
        private const val KEY_DEVICE_KEY = "device_key"
        private const val KEY_TOKEN = "access_token"
        private const val KEY_QUEUE = "sms_queue"
        private const val WORK_NAME = "paylite_sms_upload"
    }

    override fun getName(): String = "PayliteBridge"

    @ReactMethod
    fun addListener(eventName: String) {
        listenerCount++
        Log.d(TAG, "addListener called, count=$listenerCount")
        if (listenerCount == 1) {
            registerReceiver()
        }
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        listenerCount -= count
        if (listenerCount <= 0) {
            listenerCount = 0
            unregisterReceiver()
        }
    }

    @ReactMethod
    fun saveCredentials(deviceKey: String, token: String?) {
        val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().apply {
            putString(KEY_DEVICE_KEY, deviceKey)
            if (!token.isNullOrBlank()) {
                putString(KEY_TOKEN, token)
            }
            apply()
        }
        Log.d(TAG, "Credentials saved to SharedPreferences (key=${deviceKey.take(6)}...)")
    }

    @ReactMethod
    fun updateToken(token: String) {
        val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_TOKEN, token).apply()
        Log.d(TAG, "Token updated in SharedPreferences")
    }

    @ReactMethod
    fun getNativeQueueCount(promise: Promise) {
        try {
            val count = SmsUploadWorker.getQueueCount(reactContext)
            promise.resolve(count)
        } catch (e: Exception) {
            promise.resolve(0)
        }
    }

    @ReactMethod
    fun getNativeQueue(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val queue = SmsUploadWorker.getQueue(prefs)
            val result = Arguments.createArray()

            for (i in 0 until queue.length()) {
                val item = queue.optJSONObject(i) ?: continue
                val map = Arguments.createMap().apply {
                    putString("provider", item.optString("provider"))
                    putString("sender", item.optString("sender"))
                    putString("message", item.optString("message"))
                    putDouble("amount_paisa", item.optLong("amount_paisa").toDouble())
                    putString("trx_id", item.optString("trx_id"))
                    putDouble("timestamp", item.optDouble("timestamp"))
                }
                result.pushMap(map)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.resolve(Arguments.createArray())
        }
    }

    @ReactMethod
    fun clearNativeQueue(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(KEY_QUEUE, "[]").apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun triggerUpload() {
        try {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val work = OneTimeWorkRequestBuilder<SmsUploadWorker>()
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(reactContext).enqueueUniqueWork(
                WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                work
            )
            Log.d(TAG, "Upload work triggered from JS")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to trigger upload work", e)
        }
    }

    private fun sendEvent(eventName: String, sender: String, message: String) {
        try {
            val params = Arguments.createMap().apply {
                putString("sender", sender)
                putString("message", message)
                putDouble("timestamp", System.currentTimeMillis().toDouble())
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
            Log.d(TAG, "Event sent: $eventName from $sender")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send event", e)
        }
    }

    private fun registerReceiver() {
        if (receiver != null) return

        Log.d(TAG, "Registering broadcast receiver for SMS events")

        receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context?, intent: Intent?) {
                val sender = intent?.getStringExtra(
                    PaymentSmsReceiver.EXTRA_SENDER
                ) ?: return
                val message = intent.getStringExtra(
                    PaymentSmsReceiver.EXTRA_MESSAGE
                ) ?: return

                Log.d(TAG, "Received SMS broadcast from $sender: ${message.take(60)}...")
                sendEvent("onPaymentSms", sender, message)
            }
        }

        LocalBroadcastManager.getInstance(reactContext).registerReceiver(
            receiver!!,
            IntentFilter(PaymentSmsReceiver.ACTION_PAYMENT)
        )
        Log.d(TAG, "Broadcast receiver registered for SMS events")
    }

    private fun unregisterReceiver() {
        receiver?.let { r ->
            try {
                LocalBroadcastManager.getInstance(reactContext).unregisterReceiver(r)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to unregister receiver", e)
            }
            receiver = null
            Log.d(TAG, "Broadcast receiver unregistered")
        }
    }
}
