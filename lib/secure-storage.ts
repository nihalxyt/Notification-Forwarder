import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVICE_KEY = "paylite_device_key";
const ACCESS_TOKEN = "paylite_access_token";
const TOKEN_EXPIRY = "paylite_token_expiry";

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return await AsyncStorage.getItem(key);
  } else {
    return await SecureStore.getItemAsync(key);
  }
}

async function removeItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
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

  if (Date.now() > parseInt(expiry, 10)) {
    await clearAuth();
    return null;
  }

  return token;
}

export async function getTokenExpiry(): Promise<number | null> {
  const expiry = await getItem(TOKEN_EXPIRY);
  return expiry ? parseInt(expiry, 10) : null;
}

export async function clearAuth(): Promise<void> {
  await removeItem(ACCESS_TOKEN);
  await removeItem(TOKEN_EXPIRY);
}
