# Paylite

## Overview
Paylite is an Android mobile app (React Native + Expo) that listens for payment notifications from bKash, NAGAD, and Rocket, parses transaction details, and forwards them securely to a backend API at https://api.nihalhub.store.

## Architecture
- **Frontend**: Expo Router (file-based routing), React Native, TypeScript
- **Backend**: Express server on port 5000 (landing page only)
- **State**: React Context + AsyncStorage for logs, expo-secure-store for credentials
- **API Client**: JWT auth with auto re-login on 401, exponential backoff retry (1s, 3s, 8s)
- **Dedupe**: AsyncStorage-based with 7-day TTL, keyed on provider+trx_id+amount_paisa
- **Native**: Expo config plugin copies Kotlin services into Android build

## Key Files
- `lib/parser.ts` - SMS/notification parser for bKash, NAGAD, Rocket
- `lib/dedupe.ts` - Transaction deduplication with TTL
- `lib/api-client.ts` - Backend API client with auth, retry, user-friendly error messages
- `lib/secure-storage.ts` - Secure credential storage (SecureStore on native, AsyncStorage on web)
- `lib/notification-bridge.ts` - Bridge between native notification listener and app logic + native event listener
- `lib/app-context.tsx` - Global app state provider
- `app/index.tsx` - Main dashboard screen with KeyboardAvoidingView login
- `app/settings.tsx` - Settings screen (permissions, debug toggle)
- `plugins/withNotificationListener.js` - Expo config plugin that injects Kotlin services + AndroidManifest entries
- `native-android-notification-listener/PaymentNotificationListenerService.kt` - NotificationListenerService
- `native-android-notification-listener/PaymentSmsReceiver.kt` - SMS BroadcastReceiver
- `native-android-notification-listener/PayliteBridgeModule.kt` - Expo native module bridge

## Android Permissions
- RECEIVE_SMS, READ_SMS - Direct SMS reading from payment providers
- RECEIVE_BOOT_COMPLETED - Auto-start on device boot
- FOREGROUND_SERVICE - Background operation
- WAKE_LOCK - Prevent CPU sleep during processing
- POST_NOTIFICATIONS - Show notification access request
- BIND_NOTIFICATION_LISTENER_SERVICE - Notification capture service

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
- 2026-02-12: Fixed login error handling - shows friendly messages instead of raw JSON
- 2026-02-12: Added KeyboardAvoidingView for login screen
- 2026-02-12: Created Expo config plugin for native notification services
- 2026-02-12: Added SMS/notification permissions to app.json
- 2026-02-12: Disabled newArch + added ProGuard for smaller APK
- 2026-02-12: Added PayliteBridgeModule for native event communication
- 2026-02-12: Removed unused files (drizzle, shared schema, storage)
