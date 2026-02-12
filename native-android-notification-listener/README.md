# Native Android Notification Listener

This folder contains a Kotlin template for the `NotificationListenerService` that Paylite needs to receive payment notifications in the background on Android.

## Why is this needed?

Expo Go does not support custom native modules. The `NotificationListenerService` is an Android system service that requires native code. To use it, you need a **custom development build** via EAS Build.

## Files

- `PaymentNotificationListenerService.kt` — The Android service that listens for notifications from bKash, NAGAD, and Rocket (16216). It filters notifications by package name and title, then forwards the sender and message to the React Native bridge.
- `AndroidManifest.xml` — The manifest entries needed to register the service.

## Integration Steps

### 1. Prebuild the Expo project

```bash
npx expo prebuild --platform android
```

### 2. Copy the service file

Copy `PaymentNotificationListenerService.kt` to:
```
android/app/src/main/java/com/paylite/app/PaymentNotificationListenerService.kt
```

### 3. Update AndroidManifest.xml

Add the permission and service declaration from `AndroidManifest.xml` into your `android/app/src/main/AndroidManifest.xml`.

### 4. Create an Expo Module for the bridge

Create a native module that:
1. Registers a `BroadcastReceiver` to listen for `com.paylite.PAYMENT_NOTIFICATION` intents
2. Exposes an `EventEmitter` to JavaScript
3. Emits `onPaymentNotification` events with `{ sender, message }` payload

### 5. Connect to the app

In your React Native code, listen for the events:

```typescript
import { NativeEventEmitter, NativeModules } from 'react-native';

const emitter = new NativeEventEmitter(NativeModules.PayliteNotificationModule);

emitter.addListener('onPaymentNotification', (event) => {
  handleIncomingNotification(event.sender, event.message);
});
```

### 6. Build with EAS

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas init

# Build development client
eas build --profile development --platform android

# Or build APK
eas build --profile preview --platform android
```

### 7. Enable Notification Access

On the Android device:
1. Go to Settings > Apps > Special app access > Notification access
2. Enable "Paylite Payment Listener"

### 8. Disable Battery Optimization

1. Go to Settings > Apps > Paylite > Battery
2. Select "Unrestricted" or disable battery optimization

## Testing

While developing in Expo Go, use the "Test" button on the home screen to simulate incoming payment notifications. The parsing, deduplication, and API forwarding logic works identically — only the notification source is simulated.
