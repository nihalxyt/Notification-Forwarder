package com.paylite.app

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.localbroadcastmanager.content.LocalBroadcastManager

class PaymentNotificationListenerService : NotificationListenerService() {

    companion object {
        private const val TAG = "PayliteNLS"
        const val ACTION_PAYMENT = "com.paylite.PAYMENT_NOTIFICATION"
        const val EXTRA_SENDER = "sender"
        const val EXTRA_MESSAGE = "message"

        private val APP_PACKAGES = mapOf(
            "com.bKash.customerapp" to "bKash",
            "com.konasl.nagad" to "NAGAD",
            "com.dbbl.mbs.apps.main" to "16216",
        )

        private val EXACT_TITLE_MAP = mapOf(
            "bkash" to "bKash",
            "nagad" to "NAGAD",
            "16216" to "16216",
        )

        private val SMS_PACKAGES = setOf(
            "com.google.android.apps.messaging",
            "com.android.mms",
            "com.samsung.android.messaging",
            "com.oneplus.mms",
            "com.miui.mms",
            "com.sonyericsson.conversations",
            "com.htc.sense.mms",
        )

        private val MONEY_RECEIVED_PATTERNS = listOf(
            Regex("you have received", RegexOption.IGNORE_CASE),
            Regex("money received", RegexOption.IGNORE_CASE),
            Regex("Tk[\\d,.]+\\s*received", RegexOption.IGNORE_CASE),
        )
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return
        try {
            val pkg = sbn.packageName ?: return
            val extras: Bundle = sbn.notification?.extras ?: return

            val title = extras.getCharSequence("android.title")?.toString()?.trim() ?: ""
            val text = extras.getCharSequence("android.text")?.toString()?.trim() ?: ""
            val bigText = extras.getCharSequence("android.bigText")?.toString()?.trim() ?: ""
            val subText = extras.getCharSequence("android.subText")?.toString()?.trim() ?: ""
            val infoText = extras.getCharSequence("android.infoText")?.toString()?.trim() ?: ""
            val tickerText = sbn.notification?.tickerText?.toString()?.trim() ?: ""

            val candidates = listOf(bigText, tickerText, text, subText, infoText)
                .filter { it.isNotBlank() }
                .sortedByDescending { it.length }

            val message = candidates.firstOrNull() ?: return

            if (message.length < 15) return

            val sender = resolveSender(pkg, title) ?: return

            if (!isMoneyReceived(message)) return

            Log.d(TAG, "Payment detected from $sender (pkg=$pkg): ${message.take(80)}...")
            broadcastToApp(sender, message.take(500))
        } catch (e: Exception) {
            Log.e(TAG, "Error processing notification", e)
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {}

    private fun resolveSender(pkg: String, title: String): String? {
        APP_PACKAGES[pkg]?.let { return it }

        if (pkg in SMS_PACKAGES || pkg.contains("sms", ignoreCase = true) || pkg.contains("messaging", ignoreCase = true) || pkg.contains("mms", ignoreCase = true)) {
            val titleCleaned = title.lowercase().trim().replace(Regex("[^a-z0-9]"), "")
            EXACT_TITLE_MAP[titleCleaned]?.let { return it }
        }

        return null
    }

    private fun isMoneyReceived(body: String): Boolean {
        return MONEY_RECEIVED_PATTERNS.any { it.containsMatchIn(body) }
    }

    private fun broadcastToApp(sender: String, message: String) {
        val intent = Intent(ACTION_PAYMENT).apply {
            putExtra(EXTRA_SENDER, sender)
            putExtra(EXTRA_MESSAGE, message)
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
        Log.d(TAG, "Broadcast sent for $sender")
    }
}
