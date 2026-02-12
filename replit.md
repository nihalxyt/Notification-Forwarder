# Paylite

## Overview
Paylite is an Android mobile app (React Native + Expo) that listens for payment notifications from bKash, NAGAD, and Rocket, parses transaction details, and forwards them securely to a backend API at https://api.nihalhub.store.

## Architecture
- **Frontend**: Expo Router (file-based routing), React Native, TypeScript
- **Backend**: Express server on port 5000 (landing page + API proxy)
- **State**: React Context + AsyncStorage for logs, expo-secure-store for credentials
- **API Client**: JWT auth with auto re-login on 401, exponential backoff retry (1s, 3s, 8s)
- **Dedupe**: AsyncStorage-based with 7-day TTL, keyed on provider+trx_id+amount_paisa

## Key Files
- `lib/parser.ts` - SMS/notification parser for bKash, NAGAD, Rocket
- `lib/dedupe.ts` - Transaction deduplication with TTL
- `lib/api-client.ts` - Backend API client with auth and retry
- `lib/secure-storage.ts` - Secure credential storage (SecureStore on native, AsyncStorage on web)
- `lib/notification-bridge.ts` - Bridge between native notification listener and app logic
- `lib/app-context.tsx` - Global app state provider
- `app/index.tsx` - Main dashboard screen
- `app/settings.tsx` - Settings screen (permissions, debug toggle)
- `native-android-notification-listener/` - Kotlin NotificationListenerService template

## Supported Payment Providers
- bKash (sender: "bKash") - "You have received Tk X.XX ... TrxID ..."
- NAGAD (sender: "NAGAD") - "Money Received. Amount: Tk X.XX ... TxnID: ..."
- Rocket (sender: "16216") - "TkX.XX received ... TxnId:..."

## Design
- Dark navy theme with teal accents
- Inter font family
- No tabs, stack navigation with modal settings

## Recent Changes
- 2026-02-12: Initial build - complete app with login, dashboard, settings, parser, dedupe, API client, native listener template
