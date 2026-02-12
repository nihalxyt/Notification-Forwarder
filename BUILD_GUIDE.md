# Paylite APK Build Guide

## Prerequisites
- Node.js 18+ installed
- EAS CLI: `npm install -g eas-cli`
- Expo account (create at expo.dev)

## Steps to Build APK

### 1. Clone this project to your computer
Download/clone all files from Replit to a local folder.

### 2. Install dependencies
```bash
npm install
```

### 3. Login to EAS
```bash
eas login
```

### 4. Initialize EAS project
```bash
eas init
```

### 5. Generate native Android code
```bash
npx expo prebuild --platform android
```

### 6. Integrate Native Notification Listener
After prebuild, copy the Kotlin files from `native-android-notification-listener/` into the generated android project:

a. Copy `PaymentNotificationListener.kt` to:
   `android/app/src/main/java/com/paylite/app/PaymentNotificationListener.kt`

b. Add to `android/app/src/main/AndroidManifest.xml` inside `<application>`:
```xml
<service
    android:name=".PaymentNotificationListener"
    android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
    android:exported="false">
    <intent-filter>
        <action android:name="android.service.notification.NotificationListenerService" />
    </intent-filter>
</service>
```

c. Copy `proguard-rules.pro` to `android/app/proguard-rules.pro`

d. In `android/app/build.gradle`, add inside `android { buildTypes { release { ... } } }`:
```gradle
minifyEnabled true
shrinkResources true
proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
```

### 7. Build APK
```bash
eas build --profile preview --platform android
```

This builds on Expo's cloud and gives you a download link for the APK.

### 8. Build Production AAB (for Play Store)
```bash
eas build --profile production --platform android
```

## Features Built-In
- JWT authentication with auto-refresh
- Parses bKash, NAGAD, Rocket (16216) received notifications
- Deduplication with 7-day TTL
- Encrypted storage for credentials
- 8s timeout, exponential backoff retry
- Auto re-login on 401 errors
- ProGuard code obfuscation (R8)
- Crash-proof error boundaries
- Background notification listening (native module)

## API Endpoints
- Login: POST https://api.nihalhub.store/api/v1/auth/login
- Send: POST https://api.nihalhub.store/api/v1/sms
