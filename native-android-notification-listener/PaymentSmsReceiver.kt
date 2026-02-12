package com.paylite.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import android.util.Log
import androidx.localbroadcastmanager.content.LocalBroadcastManager

class PaymentSmsReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "PayliteSMS"

        private val EXACT_SENDERS = setOf(
            "bkash",
            "nagad",
            "16216",
        )

        private val SENDER_MAP = mapOf(
            "bkash" to "bKash",
            "nagad" to "NAGAD",
            "16216" to "16216",
        )

        private val MONEY_RECEIVED_PATTERNS = listOf(
            Regex("you have received", RegexOption.IGNORE_CASE),
            Regex("money received", RegexOption.IGNORE_CASE),
            Regex("Tk[\\d,.]+\\s*received", RegexOption.IGNORE_CASE),
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
                if (body.isEmpty() || body.length < 20) continue

                val sender = resolveStrictSender(address) ?: continue

                if (!isMoneyReceived(body)) continue

                Log.d(TAG, "Payment SMS from $sender: ${body.take(60)}...")

                val broadcast = Intent(PaymentNotificationListenerService.ACTION_PAYMENT).apply {
                    putExtra(PaymentNotificationListenerService.EXTRA_SENDER, sender)
                    putExtra(PaymentNotificationListenerService.EXTRA_MESSAGE, body.take(500))
                }
                LocalBroadcastManager.getInstance(context).sendBroadcast(broadcast)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing SMS", e)
        }
    }

    private fun resolveStrictSender(address: String): String? {
        val cleaned = address.lowercase().trim().replace(Regex("[^a-z0-9]"), "")

        if (cleaned in EXACT_SENDERS) {
            return SENDER_MAP[cleaned]
        }

        if (cleaned == "16216" || cleaned.endsWith("16216")) {
            return "16216"
        }

        return null
    }

    private fun isMoneyReceived(body: String): Boolean {
        return MONEY_RECEIVED_PATTERNS.any { it.containsMatchIn(body) }
    }
}
