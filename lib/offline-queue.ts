import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { ParsedTransaction } from "./types";

const QUEUE_KEY = "paylite_offline_queue";
const MAX_QUEUE_SIZE = 100;

export interface QueuedTransaction {
  id: string;
  transaction: ParsedTransaction;
  timestamp: number;
  retries: number;
}

let flushCallback: ((tx: ParsedTransaction) => Promise<{ success: boolean; error?: string }>) | null = null;
let onQueueChange: ((count: number) => void) | null = null;
let flushing = false;
let unsubscribe: (() => void) | null = null;

export function setFlushCallback(
  cb: (tx: ParsedTransaction) => Promise<{ success: boolean; error?: string }>
): void {
  flushCallback = cb;
}

export function setQueueChangeCallback(cb: (count: number) => void): void {
  onQueueChange = cb;
}

async function loadQueue(): Promise<QueuedTransaction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedTransaction[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(0, MAX_QUEUE_SIZE)));
    onQueueChange?.(queue.length);
  } catch {}
}

export async function enqueue(transaction: ParsedTransaction): Promise<void> {
  const queue = await loadQueue();
  const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
  queue.push({ id, transaction, timestamp: Date.now(), retries: 0 });
  await saveQueue(queue);
}

export async function getPendingCount(): Promise<number> {
  const queue = await loadQueue();
  return queue.length;
}

export async function flushQueue(): Promise<void> {
  if (flushing || !flushCallback) return;
  flushing = true;

  try {
    const queue = await loadQueue();
    if (queue.length === 0) {
      flushing = false;
      return;
    }

    const remaining: QueuedTransaction[] = [];

    for (const item of queue) {
      try {
        const result = await flushCallback(item.transaction);
        if (!result.success) {
          item.retries++;
          if (item.retries < 10) {
            remaining.push(item);
          }
        }
      } catch {
        item.retries++;
        if (item.retries < 10) {
          remaining.push(item);
        }
      }
    }

    await saveQueue(remaining);
  } catch {} finally {
    flushing = false;
  }
}

export function startNetworkMonitor(): void {
  if (unsubscribe) return;

  unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      setTimeout(() => flushQueue(), 2000);
    }
  });
}

export function stopNetworkMonitor(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}
