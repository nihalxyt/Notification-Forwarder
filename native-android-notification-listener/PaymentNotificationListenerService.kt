package com.paylite.app

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.os.Bundle
import android.util.Log

class PaymentNotificationListenerService : NotificationListenerService() {

    companion object {
        private const val TAG = "PayliteNLS"

        private val WHITELIST_PACKAGES = mapOf(
            "com.bKash.customerapp" to "bKash",
            "com.konasl.nagad" to "NAGAD",
        )

        private val WHITELIST_TITLES = mapOf(
            "bkash" to "bKash",
            "nagad" to "NAGAD",
            "16216" to "16216",
        )
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return

        val packageName = sbn.packageName
        val extras: Bundle = sbn.notification?.extras ?: return

        val title = extras.getCharSequence("android.title")?.toString() ?: ""
        val text = extras.getCharSequence("android.text")?.toString() ?: ""
        val bigText = extras.getCharSequence("android.bigText")?.toString() ?: ""

        val message = if (bigText.isNotBlank()) bigText else text

        if (message.isBlank()) return

        var sender: String? = null

        sender = WHITELIST_PACKAGES[packageName]

        if (sender == null) {
            val titleLower = title.lowercase()
            for ((key, value) in WHITELIST_TITLES) {
                if (titleLower.contains(key.lowercase())) {
                    sender = value
                    break
                }
            }
        }

        if (sender == null) {
            if (packageName == "com.google.android.apps.messaging" ||
                packageName == "com.android.mms" ||
                packageName.contains("sms", ignoreCase = true)) {
                val titleLower = title.lowercase()
                for ((key, value) in WHITELIST_TITLES) {
                    if (titleLower == key.lowercase() || title == key) {
                        sender = value
                        break
                    }
                }
            }
        }

        if (sender == null) return

        Log.d(TAG, "Payment notification from $sender: ${message.take(100)}")

        sendToReactNative(sender, message)
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
    }

    private fun sendToReactNative(sender: String, message: String) {
        // This method sends events to the React Native bridge.
        //
        // Integration options:
        //
        // Option A: Use expo-modules-core to create a native module
        //   1. Create an Expo Module using `npx create-expo-module`
        //   2. Emit events from this service to the module
        //   3. The module forwards events to JavaScript via EventEmitter
        //
        // Option B: Use a broadcast receiver pattern
        //   1. Send a local broadcast from this service
        //   2. A registered BroadcastReceiver in your Expo Module picks it up
        //   3. The module emits to JavaScript
        //
        // Option C: Use SharedPreferences or a local database
        //   1. Write the notification data to SharedPreferences
        //   2. A polling mechanism or FileObserver in the Expo Module reads it
        //   3. Forward to JavaScript
        //
        // For production, Option A is recommended.
        // Example implementation:
        //
        // val intent = Intent("com.paylite.PAYMENT_NOTIFICATION")
        // intent.putExtra("sender", sender)
        // intent.putExtra("message", message.take(1000))
        // LocalBroadcastManager.getInstance(this).sendBroadcast(intent)
    }
}
