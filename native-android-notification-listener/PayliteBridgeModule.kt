package com.paylite.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PayliteBridgeModule : Module() {
    private var receiver: BroadcastReceiver? = null

    override fun definition() = ModuleDefinition {
        Name("PayliteBridge")

        Events("onPaymentNotification")

        OnStartObserving {
            val context = appContext.reactContext ?: return@OnStartObserving

            receiver = object : BroadcastReceiver() {
                override fun onReceive(ctx: Context?, intent: Intent?) {
                    val sender = intent?.getStringExtra(
                        PaymentNotificationListenerService.EXTRA_SENDER
                    ) ?: return
                    val message = intent.getStringExtra(
                        PaymentNotificationListenerService.EXTRA_MESSAGE
                    ) ?: return

                    sendEvent("onPaymentNotification", mapOf(
                        "sender" to sender,
                        "message" to message,
                        "timestamp" to System.currentTimeMillis()
                    ))
                }
            }

            LocalBroadcastManager.getInstance(context).registerReceiver(
                receiver!!,
                IntentFilter(PaymentNotificationListenerService.ACTION_PAYMENT)
            )
        }

        OnStopObserving {
            receiver?.let { r ->
                val context = appContext.reactContext ?: return@OnStopObserving
                LocalBroadcastManager.getInstance(context).unregisterReceiver(r)
                receiver = null
            }
        }
    }
}
