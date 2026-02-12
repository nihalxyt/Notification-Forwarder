import { ParsedTransaction, Provider } from "./types";

const WHITELIST: Record<string, Provider> = {
  bkash: "bkash",
  nagad: "nagad",
  "16216": "rocket",
};

function normalizeWhitelistKey(sender: string): string {
  return sender.trim().toLowerCase();
}

export function isWhitelistedSender(sender: string): boolean {
  const key = normalizeWhitelistKey(sender);
  return key in WHITELIST;
}

export function getProvider(sender: string): Provider | null {
  const key = normalizeWhitelistKey(sender);
  return WHITELIST[key] ?? null;
}

function extractBkash(message: string): { amount: number; trxId: string } | null {
  const receivedPattern = /you have received/i;
  if (!receivedPattern.test(message)) return null;

  const amountMatch = message.match(/Tk\s*([\d,]+(?:\.\d{1,2})?)/i);
  const trxIdMatch = message.match(/TrxID\s+([A-Za-z0-9]+)/i);

  if (!amountMatch || !trxIdMatch) return null;

  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (isNaN(amount) || amount <= 0) return null;

  return {
    amount,
    trxId: trxIdMatch[1].toUpperCase(),
  };
}

function extractNagad(message: string): { amount: number; trxId: string } | null {
  const receivedPattern = /money received/i;
  if (!receivedPattern.test(message)) return null;

  const amountMatch = message.match(/Amount:\s*Tk\s*([\d,]+(?:\.\d{1,2})?)/i);
  const trxIdMatch = message.match(/TxnID:\s*([A-Za-z0-9]+)/i);

  if (!amountMatch || !trxIdMatch) return null;

  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (isNaN(amount) || amount <= 0) return null;

  return {
    amount,
    trxId: trxIdMatch[1].toUpperCase(),
  };
}

function extractRocket(message: string): { amount: number; trxId: string } | null {
  const receivedPattern = /received/i;
  if (!receivedPattern.test(message)) return null;

  const outgoingPatterns = /payment|sent|paid|transfer out|debit/i;
  if (outgoingPatterns.test(message)) return null;

  const amountMatch = message.match(/Tk([\d,]+(?:\.\d{1,2})?)/i);
  const trxIdMatch = message.match(/TxnId:([A-Za-z0-9]+)/i);

  if (!amountMatch || !trxIdMatch) return null;

  const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
  if (isNaN(amount) || amount <= 0) return null;

  return {
    amount,
    trxId: trxIdMatch[1].toUpperCase(),
  };
}

export function parseMessage(
  sender: string,
  rawMessage: string
): ParsedTransaction | null {
  const provider = getProvider(sender);
  if (!provider) return null;

  const message = rawMessage.slice(0, 1000);

  let result: { amount: number; trxId: string } | null = null;

  switch (provider) {
    case "bkash":
      result = extractBkash(message);
      break;
    case "nagad":
      result = extractNagad(message);
      break;
    case "rocket":
      result = extractRocket(message);
      break;
  }

  if (!result) return null;

  return {
    provider,
    sender: sender.trim(),
    message,
    amount_paisa: Math.round(result.amount * 100),
    trx_id: result.trxId,
  };
}
