import { parseMessage } from "./parser";
import { isDuplicate, markAsSent, computeMessageHash } from "./dedupe";
import { sendTransaction } from "./api-client";
import { TransactionLog, ParsedTransaction } from "./types";

type LogCallback = (log: TransactionLog) => void;

let logCallback: LogCallback | null = null;
let debugMode = false;

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
  if (logCallback) {
    logCallback(log);
  }
  if (debugMode) {
    console.log("[Paylite]", JSON.stringify(log));
  }
}

export async function handleIncomingNotification(
  sender: string,
  message: string
): Promise<void> {
  const parsed = parseMessage(sender, message);
  if (!parsed) {
    if (debugMode) {
      console.log("[Paylite] Ignored notification from:", sender);
    }
    return;
  }

  const duplicate = await isDuplicate(
    parsed.provider,
    parsed.trx_id,
    parsed.amount_paisa
  );

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

  await computeMessageHash(parsed.message);

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
      error: result.error,
    });
  }
}

export function simulateNotification(sender: string, message: string): void {
  handleIncomingNotification(sender, message);
}
