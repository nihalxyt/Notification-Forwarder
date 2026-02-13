import { ParsedTransaction, Provider } from "./types";

const SENDER_WHITELIST: Record<string, Provider> = {
  bkash: "bkash",
  nagad: "nagad",
  "16216": "rocket",
};

function normalizeSender(sender: string): string {
  return sender.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isWhitelistedSender(sender: string): boolean {
  try {
    const key = normalizeSender(sender);
    return key in SENDER_WHITELIST;
  } catch {
    return false;
  }
}

export function getProvider(sender: string): Provider | null {
  try {
    const key = normalizeSender(sender);
    return SENDER_WHITELIST[key] ?? null;
  } catch {
    return null;
  }
}

function extractBkash(message: string): { amount: number; trxId: string } | null {
  try {
    if (!/you have received/i.test(message)) return null;

    if (/recharge|cashout|cash out|withdraw|payment to|sent to|paid to|charge|merchant/i.test(message)) return null;

    const amountMatch = message.match(/(?:You have received\s+)Tk\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (!amountMatch) return null;

    const trxIdMatch = message.match(/TrxID\s+([A-Z0-9]{8,15})/i);
    if (!trxIdMatch) return null;

    const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
    if (isNaN(amount) || amount <= 0 || amount > 99999999) return null;

    const trxId = trxIdMatch[1].trim().toUpperCase();
    if (trxId.length < 8 || trxId.length > 15) return null;

    return { amount, trxId };
  } catch {
    return null;
  }
}

function extractNagad(message: string): { amount: number; trxId: string } | null {
  try {
    if (!/money received/i.test(message)) return null;

    if (/payment to|sent|paid|debit|request|cash out|withdraw/i.test(message)) return null;

    const amountMatch = message.match(/Amount:\s*Tk\s*([\d,]+(?:\.\d{1,2})?)/i);
    if (!amountMatch) return null;

    const trxIdMatch = message.match(/TxnID:\s*([A-Z0-9]{6,15})/i);
    if (!trxIdMatch) return null;

    const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
    if (isNaN(amount) || amount <= 0 || amount > 99999999) return null;

    const trxId = trxIdMatch[1].trim().toUpperCase();
    if (trxId.length < 6 || trxId.length > 15) return null;

    return { amount, trxId };
  } catch {
    return null;
  }
}

function extractRocket(message: string): { amount: number; trxId: string } | null {
  try {
    if (!/received/i.test(message)) return null;

    if (/payment|sent|paid|transfer out|debit|cashout|withdraw|request|recharge/i.test(message)) return null;

    const amountMatch = message.match(/Tk\s*([\d,]+(?:\.\d{1,2})?)\s*received/i);
    if (!amountMatch) return null;

    const trxIdMatch = message.match(/TxnId:\s*([A-Z0-9]{6,15})/i);
    if (!trxIdMatch) return null;

    const amount = parseFloat(amountMatch[1].replace(/,/g, ""));
    if (isNaN(amount) || amount <= 0 || amount > 99999999) return null;

    const trxId = trxIdMatch[1].trim().toUpperCase();
    if (trxId.length < 6 || trxId.length > 15) return null;

    return { amount, trxId };
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
    if (message.length < 15) return null;

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
