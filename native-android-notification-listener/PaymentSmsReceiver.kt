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

        private val SENDER_MAP = mapOf(
            "bkash" to "bKash",
            "nagad" to "NAGAD",
            "16216" to "16216",
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
                if (body.isEmpty()) continue

                val sender = resolveSender(address) ?: continue

                Log.d(TAG, "SMS from $sender: ${body.take(80)}")

                val broadcast = Intent(PaymentNotificationListenerService.ACTION_PAYMENT).apply {
                    putExtra(PaymentNotificationListenerService.EXTRA_SENDER, sender)
                    putExtra(PaymentNotificationListenerService.EXTRA_MESSAGE, body.take(1000))
                }
                LocalBroadcastManager.getInstance(context).sendBroadcast(broadcast)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing SMS", e)
        }
    }

    private fun resolveSender(address: String): String? {
        val addrLower = address.lowercase().trim()
        for ((key, value) in SENDER_MAP) {
            if (addrLower.contains(key)) return value
        }
        if (addrLower == "16216" || addrLower.endsWith("16216")) return "16216"
        return null
    }
}
