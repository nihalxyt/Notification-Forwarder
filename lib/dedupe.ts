import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

const DEDUPE_PREFIX = "dedupe:";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function makeKey(provider: string, trxId: string, amountPaisa: number): string {
  return `${DEDUPE_PREFIX}${provider}:${trxId}:${amountPaisa}`;
}

export async function computeMessageHash(message: string): Promise<string> {
  try {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      message
    );
  } catch {
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}

export async function isDuplicate(
  provider: string,
  trxId: string,
  amountPaisa: number
): Promise<boolean> {
  try {
    const key = makeKey(provider, trxId, amountPaisa);
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return false;

    const expiry = parseInt(stored, 10);
    if (isNaN(expiry)) {
      await AsyncStorage.removeItem(key).catch(() => {});
      return false;
    }

    if (Date.now() > expiry) {
      await AsyncStorage.removeItem(key).catch(() => {});
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function markAsSent(
  provider: string,
  trxId: string,
  amountPaisa: number
): Promise<void> {
  try {
    const key = makeKey(provider, trxId, amountPaisa);
    const expiry = (Date.now() + TTL_MS).toString();
    await AsyncStorage.setItem(key, expiry);
  } catch (e) {
    console.warn("[Paylite] Failed to mark as sent:", e);
  }
}

export async function cleanExpiredEntries(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const dedupeKeys = keys.filter((k) => k.startsWith(DEDUPE_PREFIX));

    if (dedupeKeys.length === 0) return;

    const now = Date.now();
    const toRemove: string[] = [];

    const pairs = await AsyncStorage.multiGet(dedupeKeys);
    for (const [key, val] of pairs) {
      if (val) {
        const expiry = parseInt(val, 10);
        if (isNaN(expiry) || now > expiry) {
          toRemove.push(key);
        }
      }
    }

    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch (e) {
    console.warn("[Paylite] Failed to clean expired entries:", e);
  }
}
