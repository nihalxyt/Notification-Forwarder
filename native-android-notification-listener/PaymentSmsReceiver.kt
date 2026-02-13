package com.paylite.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

class PaymentSmsReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "PayliteSMS"
        const val ACTION_PAYMENT = "com.paylite.PAYMENT_NOTIFICATION"
        const val EXTRA_SENDER = "sender"
        const val EXTRA_MESSAGE = "message"
        private const val WORK_NAME = "paylite_sms_upload"

        private val SENDER_MAP = mapOf(
            "bkash" to "bKash",
            "nagad" to "NAGAD",
            "16216" to "16216",
        )

        private val MONEY_KEYWORDS = listOf(
            "received",
            "money received",
        )

        private data class ParsedSms(
            val provider: String,
            val trxId: String,
            val amountPaisa: Long,
        )
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        try {
            val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
            if (messages.isNullOrEmpty()) return

            val grouped = mutableMapOf<String, StringBuilder>()
            for (msg in messages) {
                val addr = msg.originatingAddress?.trim() ?: continue
                val body = msg.messageBody ?: continue
                grouped.getOrPut(addr) { StringBuilder() }.append(body)
            }

            for ((address, bodyBuilder) in grouped) {
                val body = bodyBuilder.toString().trim()
                if (body.isEmpty() || body.length < 15) continue

                val sender = resolveStrictSender(address) ?: continue

                if (!containsMoneyKeyword(body)) continue

                val parsed = parseTransaction(sender, body) ?: continue

                Log.d(TAG, "Payment SMS from $sender: ${parsed.provider} ${parsed.trxId} ${parsed.amountPaisa}")

                SmsUploadWorker.enqueueSms(
                    context,
                    sender,
                    body.take(500),
                    parsed.provider,
                    parsed.trxId,
                    parsed.amountPaisa
                )

                enqueueUploadWork(context)

                try {
                    val broadcast = Intent(ACTION_PAYMENT).apply {
                        putExtra(EXTRA_SENDER, sender)
                        putExtra(EXTRA_MESSAGE, body.take(500))
                    }
                    LocalBroadcastManager.getInstance(context).sendBroadcast(broadcast)
                } catch (e: Exception) {
                    Log.d(TAG, "LocalBroadcast failed (app may be closed): ${e.message}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing SMS", e)
        }
    }

    private fun resolveStrictSender(address: String): String? {
        val cleaned = address.lowercase().trim().replace(Regex("[^a-z0-9]"), "")
        SENDER_MAP[cleaned]?.let { return it }
        if (cleaned.endsWith("16216")) return "16216"
        return null
    }

    private fun containsMoneyKeyword(body: String): Boolean {
        val lower = body.lowercase()
        return MONEY_KEYWORDS.any { lower.contains(it) }
    }

    private fun parseTransaction(sender: String, body: String): ParsedSms? {
        return when (sender) {
            "bKash" -> parseBkash(body)
            "NAGAD" -> parseNagad(body)
            "16216" -> parseRocket(body)
            else -> null
        }
    }

    private fun parseBkash(body: String): ParsedSms? {
        if (!body.contains("You have received", ignoreCase = true)) return null
        if (body.contains("recharge|cashout|cash out|withdraw|payment to|sent to|paid to|charge|merchant".toRegex(RegexOption.IGNORE_CASE))) return null

        val amountMatch = Regex("You have received\\s+Tk\\s*([\\d,]+(?:\\.\\d{1,2})?)", RegexOption.IGNORE_CASE).find(body)
            ?: return null
        val trxMatch = Regex("TrxID\\s+([A-Z0-9]{8,15})", RegexOption.IGNORE_CASE).find(body)
            ?: return null

        val amount = amountMatch.groupValues[1].replace(",", "").toDoubleOrNull() ?: return null
        if (amount <= 0 || amount > 99999999) return null

        val trxId = trxMatch.groupValues[1].uppercase()
        if (trxId.length < 8 || trxId.length > 15) return null

        return ParsedSms("bkash", trxId, Math.round(amount * 100))
    }

    private fun parseNagad(body: String): ParsedSms? {
        if (!body.contains("Money Received", ignoreCase = true)) return null
        if (body.contains("payment to|sent|paid|debit|request|cash out|withdraw".toRegex(RegexOption.IGNORE_CASE))) return null

        val amountMatch = Regex("Amount:\\s*Tk\\s*([\\d,]+(?:\\.\\d{1,2})?)", RegexOption.IGNORE_CASE).find(body)
            ?: return null
        val trxMatch = Regex("TxnID:\\s*([A-Z0-9]{6,15})", RegexOption.IGNORE_CASE).find(body)
            ?: return null

        val amount = amountMatch.groupValues[1].replace(",", "").toDoubleOrNull() ?: return null
        if (amount <= 0 || amount > 99999999) return null

        val trxId = trxMatch.groupValues[1].uppercase()
        if (trxId.length < 6 || trxId.length > 15) return null

        return ParsedSms("nagad", trxId, Math.round(amount * 100))
    }

    private fun parseRocket(body: String): ParsedSms? {
        if (!body.contains("received", ignoreCase = true)) return null
        if (body.contains("payment|sent|paid|transfer out|debit|cashout|withdraw|request|recharge".toRegex(RegexOption.IGNORE_CASE))) return null

        val amountMatch = Regex("Tk\\s*([\\d,]+(?:\\.\\d{1,2})?)\\s*received", RegexOption.IGNORE_CASE).find(body)
            ?: return null
        val trxMatch = Regex("TxnId:\\s*([A-Z0-9]{6,15})", RegexOption.IGNORE_CASE).find(body)
            ?: return null

        val amount = amountMatch.groupValues[1].replace(",", "").toDoubleOrNull() ?: return null
        if (amount <= 0 || amount > 99999999) return null

        val trxId = trxMatch.groupValues[1].uppercase()
        if (trxId.length < 6 || trxId.length > 15) return null

        return ParsedSms("rocket", trxId, Math.round(amount * 100))
    }

    private fun enqueueUploadWork(context: Context) {
        try {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val work = OneTimeWorkRequestBuilder<SmsUploadWorker>()
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                work
            )

            Log.d(TAG, "Upload work enqueued (requires network)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to enqueue work", e)
        }
    }
}
