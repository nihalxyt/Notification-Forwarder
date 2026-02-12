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
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    if (payload.exp && typeof payload.exp === "number") {
      return payload.exp * 1000;
    }
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
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

function isNetworkError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("timeout") ||
    msg.includes("abort") ||
    msg.includes("connection") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("dns")
  );
}

export async function login(deviceKey: string): Promise<{
  success: boolean;
  expiry: number | null;
  error?: string;
}> {
  try {
    if (!deviceKey || deviceKey.trim().length === 0) {
      return { success: false, expiry: null, error: "Device key is empty" };
    }

    const response = await fetchWithTimeout(`${BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_key: deviceKey.trim() }),
    });

    if (!response.ok) {
      let errorMsg = `Server error (${response.status})`;
      try {
        const body = await response.json();
        if (body?.detail) {
          if (typeof body.detail === "string") {
            errorMsg = body.detail;
          } else if (Array.isArray(body.detail) && body.detail.length > 0) {
            const first = body.detail[0];
            if (first?.msg) {
              errorMsg = first.msg;
            }
          }
        } else if (body?.message) {
          errorMsg = body.message;
        }
      } catch {
        try {
          const text = await response.text();
          if (text && text.length < 100) errorMsg = text;
        } catch {}
      }

      const friendlyMessages: Record<string, string> = {
        "String should have at least 10 characters": "Device key must be at least 10 characters",
        "Invalid device key": "Invalid device key. Please check and try again.",
        "Device not found": "Device not found. Contact your administrator.",
        "Unauthorized": "Authentication failed. Check your device key.",
      };

      for (const [key, friendly] of Object.entries(friendlyMessages)) {
        if (errorMsg.toLowerCase().includes(key.toLowerCase())) {
          errorMsg = friendly;
          break;
        }
      }

      return { success: false, expiry: null, error: errorMsg };
    }

    let data: AuthResponse;
    try {
      data = await response.json();
    } catch {
      return { success: false, expiry: null, error: "Invalid server response" };
    }

    if (!data.access_token) {
      return { success: false, expiry: null, error: "No token received" };
    }

    const expiry = parseJwtExpiry(data.access_token);
    await saveToken(data.access_token, expiry);

    return { success: true, expiry };
  } catch (error: any) {
    const msg = error?.message || "Login failed";
    return {
      success: false,
      expiry: null,
      error: isNetworkError(error) ? "Network error. Check your connection." : msg,
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
        message: transaction.message.slice(0, 1000),
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

    let text = `Server error (${response.status})`;
    try {
      const body = await response.text();
      if (body) text = body.slice(0, 200);
    } catch {}

    if (attempt < RETRY_DELAYS.length - 1) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      return sendWithRetry(transaction, token, attempt + 1);
    }

    return { success: false, error: text };
  } catch (error: any) {
    if (
      error?.message === "UNAUTHORIZED" ||
      error === "UNAUTHORIZED"
    ) {
      return { success: false, error: "UNAUTHORIZED" };
    }

    if (attempt < RETRY_DELAYS.length - 1) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      return sendWithRetry(transaction, token, attempt + 1);
    }

    return {
      success: false,
      error: isNetworkError(error) ? "Network error" : (error?.message || "Send failed"),
    };
  }
}

export async function sendTransaction(
  transaction: ParsedTransaction
): Promise<{ success: boolean; error?: string }> {
  try {
    let token = await getToken();

    if (!token) {
      const deviceKey = await getDeviceKey();
      if (!deviceKey) return { success: false, error: "No device key saved" };

      const loginResult = await login(deviceKey);
      if (!loginResult.success) return { success: false, error: loginResult.error };

      token = await getToken();
      if (!token) return { success: false, error: "Failed to get token after login" };
    }

    const result = await sendWithRetry(transaction, token);

    if (result.error === "UNAUTHORIZED") {
      await clearAuth();
      const deviceKey = await getDeviceKey();
      if (!deviceKey) return { success: false, error: "No device key for re-login" };

      const loginResult = await login(deviceKey);
      if (!loginResult.success) return { success: false, error: `Re-login failed: ${loginResult.error}` };

      const newToken = await getToken();
      if (!newToken) return { success: false, error: "No token after re-login" };

      return sendWithRetry(transaction, newToken);
    }

    return result;
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Unexpected error sending transaction",
    };
  }
}
