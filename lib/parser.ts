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
  try {
    const key = normalizeWhitelistKey(sender);
    return key in WHITELIST;
  } catch {
    return false;
  }
}

export function getProvider(sender: string): Provider | null {
  try {
    const key = normalizeWhitelistKey(sender);
    return WHITELIST[key] ?? null;
  } catch {
    return null;
  }
}

function extractBkash(message: string): { amount: number; trxId: string } | null {
  try {
    const receivedPattern = /you have received/i;
    if (!receivedPattern.test(message)) return null;

    const outgoingPatterns = /payment|sent|paid|cashout|cash out|withdraw/i;
    if (outgoingPatterns.test(message.split("TrxID")[0] || "")) return null;

    const amountMatch = message.match(/Tk\s*([\d,]+(?:\.\d{1,2})?)/i);
    const trxIdMatch = message.match(/TrxID\s+([A-Za-z0-9]+)/i);

    if (!amountMatch || !trxIdMatch) return null;

    const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
    if (isNaN(amount) || amount <= 0 || amount > 99999999) return null;

    const trxId = trxIdMatch[1].trim();
    if (trxId.length < 4 || trxId.length > 30) return null;

    return {
      amount,
      trxId: trxId.toUpperCase(),
    };
  } catch {
    return null;
  }
}

function extractNagad(message: string): { amount: number; trxId: string } | null {
  try {
    const receivedPattern = /money received/i;
    if (!receivedPattern.test(message)) return null;

    const outgoingPatterns = /payment to|sent|paid|debit/i;
    if (outgoingPatterns.test(message)) return null;

    const amountMatch = message.match(/Amount:\s*Tk\s*([\d,]+(?:\.\d{1,2})?)/i);
    const trxIdMatch = message.match(/TxnID:\s*([A-Za-z0-9]+)/i);

    if (!amountMatch || !trxIdMatch) return null;

    const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
    if (isNaN(amount) || amount <= 0 || amount > 99999999) return null;

    const trxId = trxIdMatch[1].trim();
    if (trxId.length < 4 || trxId.length > 30) return null;

    return {
      amount,
      trxId: trxId.toUpperCase(),
    };
  } catch {
    return null;
  }
}

function extractRocket(message: string): { amount: number; trxId: string } | null {
  try {
    const receivedPattern = /received/i;
    if (!receivedPattern.test(message)) return null;

    const outgoingPatterns = /payment|sent|paid|transfer out|debit|cashout|withdraw/i;
    if (outgoingPatterns.test(message)) return null;

    const amountMatch = message.match(/Tk([\d,]+(?:\.\d{1,2})?)/i);
    const trxIdMatch = message.match(/TxnId:([A-Za-z0-9]+)/i);

    if (!amountMatch || !trxIdMatch) return null;

    const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
    if (isNaN(amount) || amount <= 0 || amount > 99999999) return null;

    const trxId = trxIdMatch[1].trim();
    if (trxId.length < 4 || trxId.length > 30) return null;

    return {
      amount,
      trxId: trxId.toUpperCase(),
    };
  } catch {
    return null;
  }
}

export function parseMessage(
  sender: string,
  rawMessage: string
): ParsedTransaction | null {
  try {
    if (!sender || !rawMessage) return null;

    const provider = getProvider(sender);
    if (!provider) return null;

    const message = rawMessage.slice(0, 1000).trim();
    if (message.length === 0) return null;

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
  } catch {
    return null;
  }
}
