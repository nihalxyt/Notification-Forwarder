import { parseMessage } from "./parser";
import { isDuplicate, markAsSent } from "./dedupe";
import { sendTransaction } from "./api-client";
import { TransactionLog } from "./types";

type LogCallback = (log: TransactionLog) => void;

let logCallback: LogCallback | null = null;
let debugMode = false;
let processing = false;
const queue: Array<{ sender: string; message: string }> = [];

export function setLogCallback(cb: LogCallback): void {
  logCallback = cb;
}

export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;
}

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function addLog(log: TransactionLog): void {
  try {
    if (logCallback) logCallback(log);
  } catch {}
  if (debugMode) console.log("[Paylite]", JSON.stringify(log));
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
