import { Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { parseMessage } from "./parser";
import { isDuplicate, markAsSent } from "./dedupe";
import { sendTransaction } from "./api-client";
import { TransactionLog, ParsedTransaction } from "./types";
import { enqueue, flushQueue, setFlushCallback, startNetworkMonitor } from "./offline-queue";

type LogCallback = (log: TransactionLog) => void;

let logCallback: LogCallback | null = null;
let processing = false;
let nativeListenerActive = false;
const queue: Array<{ sender: string; message: string }> = [];

export function setLogCallback(cb: LogCallback): void {
  logCallback = cb;
}

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function addLog(log: TransactionLog): void {
  try {
    if (logCallback) logCallback(log);
  } catch {}
}

async function isOnline(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return !!(state.isConnected && state.isInternetReachable !== false);
  } catch {
    return true;
  }
}

async function processNotification(sender: string, message: string): Promise<void> {
  try {
    const parsed = parseMessage(sender, message);
    if (!parsed) return;

    const duplicate = await isDuplicate(parsed.provider, parsed.trx_id, parsed.amount_paisa);
    if (duplicate) {
      addLog({
        id: generateId(),
        timestamp: Date.now(),
        provider: parsed.provider,
        trx_id: parsed.trx_id,
        amount_paisa: parsed.amount_paisa,
        status: "ignored",
        error: "Duplicate",
      });
      return;
    }

    const online = await isOnline();

    if (!online) {
      await enqueue(parsed);
      addLog({
        id: generateId(),
        timestamp: Date.now(),
        provider: parsed.provider,
        trx_id: parsed.trx_id,
        amount_paisa: parsed.amount_paisa,
        status: "failed",
        error: "Offline - queued for retry",
      });
      return;
    }

    const result = await sendTransaction(parsed);

    if (result.success) {
      await markAsSent(parsed.provider, parsed.trx_id, parsed.amount_paisa);
      addLog({
        id: generateId(),
        timestamp: Date.now(),
        provider: parsed.provider,
        trx_id: parsed.trx_id,
        amount_paisa: parsed.amount_paisa,
        status: "sent",
      });
    } else {
      const isNetErr = result.error?.toLowerCase().includes("network") ||
                        result.error?.toLowerCase().includes("timeout") ||
                        result.error?.toLowerCase().includes("connection");
      if (isNetErr) {
        await enqueue(parsed);
        addLog({
          id: generateId(),
          timestamp: Date.now(),
          provider: parsed.provider,
          trx_id: parsed.trx_id,
          amount_paisa: parsed.amount_paisa,
          status: "failed",
          error: "Network error - queued for retry",
        });
      } else {
        addLog({
          id: generateId(),
          timestamp: Date.now(),
          provider: parsed.provider,
          trx_id: parsed.trx_id,
          amount_paisa: parsed.amount_paisa,
          status: "failed",
          error: result.error?.slice(0, 100),
        });
      }
    }
  } catch (e: any) {
    console.error("[Paylite] Error:", e);
  }
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item) await processNotification(item.sender, item.message);
    }
  } finally {
    processing = false;
  }
}

export async function handleIncomingNotification(
  sender: string,
  message: string
): Promise<void> {
  if (!sender || !message) return;
  queue.push({ sender, message });
  processQueue();
}

export function initOfflineQueue(): void {
  setFlushCallback(async (tx: ParsedTransaction) => {
    const result = await sendTransaction(tx);
    if (result.success) {
      await markAsSent(tx.provider, tx.trx_id, tx.amount_paisa);
      addLog({
        id: generateId(),
        timestamp: Date.now(),
        provider: tx.provider,
        trx_id: tx.trx_id,
        amount_paisa: tx.amount_paisa,
        status: "sent",
      });
    }
    return result;
  });

  startNetworkMonitor();
  flushQueue().catch(() => {});
}

export function startNativeListener(): void {
  if (Platform.OS !== "android" || nativeListenerActive) return;

  try {
    const NativeModules = require("react-native").NativeModules;
    const { NativeEventEmitter } = require("react-native");

    let PayliteBridge: any = null;
    try {
      PayliteBridge = NativeModules.PayliteBridge;
    } catch {}

    if (!PayliteBridge) {
      try {
        const ExpoModules = require("expo-modules-core");
        PayliteBridge = ExpoModules.requireNativeModule("PayliteBridge");
      } catch {}
    }

    if (!PayliteBridge) return;

    const emitter = new NativeEventEmitter(PayliteBridge);
    emitter.addListener("onPaymentNotification", (event: any) => {
      if (event?.sender && event?.message) {
        handleIncomingNotification(event.sender, event.message);
      }
    });

    nativeListenerActive = true;
  } catch {}
}

export function isNativeListenerActive(): boolean {
  return nativeListenerActive;
}
