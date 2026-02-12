import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

const DEDUPE_PREFIX = "dedupe:";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

function makeKey(provider: string, trxId: string, amountPaisa: number): string {
  return `${DEDUPE_PREFIX}${provider}:${trxId}:${amountPaisa}`;
}

export async function computeMessageHash(message: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    message
  );
}

export async function isDuplicate(
  provider: string,
  trxId: string,
  amountPaisa: number
): Promise<boolean> {
  const key = makeKey(provider, trxId, amountPaisa);
  const stored = await AsyncStorage.getItem(key);
  if (!stored) return false;

  const expiry = parseInt(stored, 10);
  if (Date.now() > expiry) {
    await AsyncStorage.removeItem(key);
    return false;
  }

  return true;
}

export async function markAsSent(
  provider: string,
  trxId: string,
  amountPaisa: number
): Promise<void> {
  const key = makeKey(provider, trxId, amountPaisa);
  const expiry = (Date.now() + TTL_MS).toString();
  await AsyncStorage.setItem(key, expiry);
}

export async function cleanExpiredEntries(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const dedupeKeys = keys.filter((k) => k.startsWith(DEDUPE_PREFIX));

  const now = Date.now();
  const toRemove: string[] = [];

  for (const key of dedupeKeys) {
    const val = await AsyncStorage.getItem(key);
    if (val) {
      const expiry = parseInt(val, 10);
      if (now > expiry) {
        toRemove.push(key);
      }
    }
  }

  if (toRemove.length > 0) {
    await AsyncStorage.multiRemove(toRemove);
  }
}
