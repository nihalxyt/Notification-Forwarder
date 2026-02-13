package com.paylite.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.util.Log
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule

class PayliteBridgeModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private var receiver: BroadcastReceiver? = null
    private var listenerCount = 0

    companion object {
        private const val TAG = "PayliteBridge"
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

        Log.d(TAG, "Registering broadcast receiver")

        receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context?, intent: Intent?) {
                val sender = intent?.getStringExtra(
                    PaymentNotificationListenerService.EXTRA_SENDER
                ) ?: return
                val message = intent.getStringExtra(
                    PaymentNotificationListenerService.EXTRA_MESSAGE
                ) ?: return

                Log.d(TAG, "Received broadcast from $sender: ${message.take(60)}...")
                sendEvent("onPaymentNotification", sender, message)
            }
        }

        LocalBroadcastManager.getInstance(reactContext).registerReceiver(
            receiver!!,
            IntentFilter(PaymentNotificationListenerService.ACTION_PAYMENT)
        )
        Log.d(TAG, "Broadcast receiver registered")
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
