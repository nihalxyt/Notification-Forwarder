import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVICE_KEY = "paylite_device_key";
const ACCESS_TOKEN = "paylite_access_token";
const TOKEN_EXPIRY = "paylite_token_expiry";

async function setItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      await AsyncStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch (e) {
    console.warn("[Paylite] SecureStore set failed, falling back:", e);
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e2) {
      console.error("[Paylite] AsyncStorage fallback also failed:", e2);
    }
  }
}

async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return await AsyncStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  } catch (e) {
    console.warn("[Paylite] SecureStore get failed, falling back:", e);
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  }
}

async function removeItem(key: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      await AsyncStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch {
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  }
}

export async function saveDeviceKey(key: string): Promise<void> {
  await setItem(DEVICE_KEY, key);
}

export async function getDeviceKey(): Promise<string | null> {
  return await getItem(DEVICE_KEY);
}

export async function saveToken(token: string, expiryMs: number): Promise<void> {
  await setItem(ACCESS_TOKEN, token);
  await setItem(TOKEN_EXPIRY, expiryMs.toString());
}

export async function getToken(): Promise<string | null> {
  const token = await getItem(ACCESS_TOKEN);
  const expiry = await getItem(TOKEN_EXPIRY);

  if (!token || !expiry) return null;

  const expiryNum = parseInt(expiry, 10);
  if (isNaN(expiryNum)) {
    await clearAuth();
    return null;
  }

  if (Date.now() > expiryNum) {
    await clearAuth();
    return null;
  }

  return token;
}

export async function getTokenExpiry(): Promise<number | null> {
  try {
    const expiry = await getItem(TOKEN_EXPIRY);
    if (!expiry) return null;
    const num = parseInt(expiry, 10);
    return isNaN(num) ? null : num;
  } catch {
    return null;
  }
}

export async function clearAuth(): Promise<void> {
  await removeItem(ACCESS_TOKEN);
  await removeItem(TOKEN_EXPIRY);
}
