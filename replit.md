# Paylite

## Overview
Paylite is an Android mobile app (React Native + Expo) that captures payment SMS from bKash, NAGAD, and Rocket via direct SMS reading (RECEIVE_SMS + READ_SMS), parses transaction details, and forwards them securely to a backend API at https://api.nihalhub.store. SMS-only approach - no NotificationListenerService or foreground services for zero battery impact.

## Architecture
- **Frontend**: Expo Router (file-based routing), React Native, TypeScript
- **Backend**: Express server on port 5000 (landing page only)
- **State**: React Context + AsyncStorage for logs, expo-secure-store for credentials
- **API Client**: JWT auth with auto re-login on 401, exponential backoff retry (1s, 3s, 8s)
- **Dedupe**: Dual-layer: AsyncStorage (JS) + SharedPreferences sent_ids (native), keyed on provider+trx_id+amount_paisa
- **Native**: Expo config plugin copies Kotlin SMS receiver + bridge + WorkManager worker into Android build
- **SMS Detection**: Event-driven BroadcastReceiver - only activates when SMS arrives (zero background overhead)
- **Background Upload**: WorkManager with NetworkType.CONNECTED constraint - uploads queued SMS even when app is killed
- **Native Queue**: SharedPreferences-based queue in Kotlin - survives app kill, processed by WorkManager
- **Credentials Sync**: Device key + token saved to SharedPreferences so native Worker can auth independently

## Key Files
- `lib/parser.ts` - SMS parser for bKash, NAGAD, Rocket (incoming payments only)
- `lib/dedupe.ts` - Transaction deduplication with TTL (JS layer)
- `lib/api-client.ts` - Backend API client with auth, retry, user-friendly error messages
- `lib/secure-storage.ts` - Secure credential storage (SecureStore on native, AsyncStorage on web)
- `lib/notification-bridge.ts` - Bridge between native SMS receiver and app logic + credential sync to native
- `lib/offline-queue.ts` - Offline transaction queue with auto-retry on network reconnect (max 100 queued, 10 retries)
- `lib/status-notification.ts` - Persistent "Listening" status notification (low priority, no sound/vibration)
- `lib/app-context.tsx` - Global app state provider (always-active listening when logged in)
- `app/index.tsx` - Main dashboard screen with KeyboardAvoidingView login, always-active status
- `app/settings.tsx` - Settings screen (SMS permissions, notification permission, offline queue count)
- `plugins/withNotificationListener.js` - Expo config plugin (copies Kotlin files, adds WorkManager dependency, AndroidManifest entries)
- `native-android-notification-listener/PaymentSmsReceiver.kt` - SMS BroadcastReceiver (parse + enqueue to SharedPreferences + trigger WorkManager)
- `native-android-notification-listener/SmsUploadWorker.kt` - WorkManager Worker (auth + upload from native queue, runs even when app killed)
- `native-android-notification-listener/PayliteBridgeModule.kt` - Expo native module bridge (events + saveCredentials + queue management)
- `native-android-notification-listener/PayliteBridgePackage.kt` - React Native package registration

## Android Permissions
- RECEIVE_SMS, READ_SMS - Direct SMS reading from payment providers
- POST_NOTIFICATIONS - Show "Listening" status notification

## Supported Payment Providers
- bKash (sender: "bKash") - "You have received Tk X.XX ... TrxID ..."
- NAGAD (sender: "NAGAD") - "Money Received. Amount: Tk X.XX ... TxnID: ..."
- Rocket (sender: "16216") - "TkX.XX received ... TxnId:..."

## Design
- Dark navy theme (#060D1B bg, #00E5BF accent)
- Inter font family
- No tabs, stack navigation with modal settings
- Glassmorphic cards, animated entry

## Build
- EAS Build for APK: `npx eas-cli@latest build --platform android --profile preview`
- Production (with ProGuard): `npx eas-cli@latest build --platform android --profile production`
- newArchEnabled: false (reduces APK size)
- EAS project ID: 1d729409-1789-460f-b43e-d2af4db3eb56

## Recent Changes
- 2026-02-13: Added WorkManager-based background upload (works even when app is killed)
- 2026-02-13: Added native SharedPreferences queue (SMS saved in Kotlin, survives app kill)
- 2026-02-13: Added SmsUploadWorker.kt with auth + upload + dedup + retry
- 2026-02-13: BroadcastReceiver now parses SMS natively + enqueues to SharedPreferences + triggers WorkManager
- 2026-02-13: PayliteBridgeModule gains saveCredentials, updateToken, getNativeQueueCount, triggerUpload
- 2026-02-13: Config plugin now adds WorkManager dependency to build.gradle
- 2026-02-13: Dual-layer dedup: JS AsyncStorage + native SharedPreferences sent_ids
- 2026-02-13: Credentials sync to native SharedPreferences so Worker can auth independently
- 2026-02-13: Removed NotificationListenerService - fully SMS-only approach
- 2026-02-13: Removed FOREGROUND_SERVICE, WAKE_LOCK, RECEIVE_BOOT_COMPLETED permissions
- 2026-02-13: Added persistent "Listening" status notification (low priority, silent)
- 2026-02-13: Updated notification-bridge to SMS-only event flow (onPaymentSms)
- 2026-02-13: Simplified settings - removed notification listener option
- 2026-02-12: Removed debug mode UI and pause toggle (always active when logged in)
- 2026-02-12: Changed footer to "Powered by Nihal X"
- 2026-02-12: Implemented offline queue with auto-retry on network reconnect
- 2026-02-12: Fixed login error handling - shows friendly messages instead of raw JSON
- 2026-02-12: Added KeyboardAvoidingView for login screen
- 2026-02-12: Created Expo config plugin for native SMS receiver
- 2026-02-12: Disabled newArch + added ProGuard for smaller APK
- 2026-02-12: Added PayliteBridgeModule for native event communication
- 2026-02-12: Removed unused files (drizzle, shared schema, storage)
