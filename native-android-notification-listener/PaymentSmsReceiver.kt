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
        const val ACTION_PAYMENT = "com.paylite.PAYMENT_NOTIFICATION"
        const val EXTRA_SENDER = "sender"
        const val EXTRA_MESSAGE = "message"

        private val SENDER_MAP = mapOf(
            "bkash" to "bKash",
            "nagad" to "NAGAD",
            "16216" to "16216",
        )

        private val MONEY_KEYWORDS = listOf(
            "received",
            "money received",
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

                Log.d(TAG, "Payment SMS from $sender: ${body.take(80)}...")

                val broadcast = Intent(ACTION_PAYMENT).apply {
                    putExtra(EXTRA_SENDER, sender)
                    putExtra(EXTRA_MESSAGE, body.take(500))
                }
                LocalBroadcastManager.getInstance(context).sendBroadcast(broadcast)
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
}
