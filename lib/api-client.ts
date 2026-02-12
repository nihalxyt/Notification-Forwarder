import { AuthResponse, ParsedTransaction } from "./types";
import {
  saveToken,
  getToken,
  getDeviceKey,
  clearAuth,
} from "./secure-storage";

const BASE_URL = "https://api.nihalhub.store";
const TIMEOUT_MS = 8000;
const RETRY_DELAYS = [1000, 3000, 8000];

function parseJwtExpiry(token: string): number {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return Date.now() + 3600000;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp) return payload.exp * 1000;
    return Date.now() + 3600000;
  } catch {
    return Date.now() + 3600000;
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number = TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

export async function login(deviceKey: string): Promise<{
  success: boolean;
  expiry: number | null;
  error?: string;
}> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_key: deviceKey }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, expiry: null, error: `${response.status}: ${text}` };
    }

    const data: AuthResponse = await response.json();
    const expiry = parseJwtExpiry(data.access_token);
    await saveToken(data.access_token, expiry);

    return { success: true, expiry };
  } catch (error: any) {
    return {
      success: false,
      expiry: null,
      error: error.message || "Login failed",
    };
  }
}

async function sendWithRetry(
  transaction: ParsedTransaction,
  token: string,
  attempt: number = 0
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/api/v1/sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        provider: transaction.provider,
        sender: transaction.sender,
        message: transaction.message,
        amount_paisa: transaction.amount_paisa,
        trx_id: transaction.trx_id,
      }),
    });

    if (response.ok) {
      return { success: true };
    }

    if (response.status === 401) {
      return { success: false, error: "UNAUTHORIZED" };
    }

    const text = await response.text();
    throw new Error(`${response.status}: ${text}`);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error === "UNAUTHORIZED") {
      return { success: false, error: "UNAUTHORIZED" };
    }

    if (attempt < RETRY_DELAYS.length - 1) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      return sendWithRetry(transaction, token, attempt + 1);
    }

    return { success: false, error: error.message || "Network error" };
  }
}

export async function sendTransaction(
  transaction: ParsedTransaction
): Promise<{ success: boolean; error?: string }> {
  let token = await getToken();

  if (!token) {
    const deviceKey = await getDeviceKey();
    if (!deviceKey) return { success: false, error: "No device key" };

    const loginResult = await login(deviceKey);
    if (!loginResult.success) return { success: false, error: loginResult.error };

    token = await getToken();
    if (!token) return { success: false, error: "Login failed" };
  }

  const result = await sendWithRetry(transaction, token);

  if (result.error === "UNAUTHORIZED") {
    await clearAuth();
    const deviceKey = await getDeviceKey();
    if (!deviceKey) return { success: false, error: "No device key" };

    const loginResult = await login(deviceKey);
    if (!loginResult.success) return { success: false, error: loginResult.error };

    const newToken = await getToken();
    if (!newToken) return { success: false, error: "Re-login failed" };

    return sendWithRetry(transaction, newToken);
  }

  return result;
}
