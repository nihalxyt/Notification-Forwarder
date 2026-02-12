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

        private val TITLE_MAP = mapOf(
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

            val message = when {
                bigText.isNotBlank() -> bigText
                text.isNotBlank() -> text
                else -> return
            }

            val sender = resolveSender(pkg, title) ?: return

            Log.d(TAG, "Payment from $sender: ${message.take(80)}")
            broadcastToApp(sender, message.take(1000))
        } catch (e: Exception) {
            Log.e(TAG, "Error processing notification", e)
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {}

    private fun resolveSender(pkg: String, title: String): String? {
        APP_PACKAGES[pkg]?.let { return it }

        val tLower = title.lowercase()
        TITLE_MAP.entries.firstOrNull { tLower.contains(it.key) }?.let { return it.value }

        if (pkg in SMS_PACKAGES || pkg.contains("sms", ignoreCase = true) || pkg.contains("messaging", ignoreCase = true)) {
            TITLE_MAP.entries.firstOrNull { title.equals(it.key, ignoreCase = true) || title == it.key }?.let { return it.value }
        }

        return null
    }

    private fun broadcastToApp(sender: String, message: String) {
        val intent = Intent(ACTION_PAYMENT).apply {
            putExtra(EXTRA_SENDER, sender)
            putExtra(EXTRA_MESSAGE, message)
        }
        LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }
}
