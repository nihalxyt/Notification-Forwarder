export type Provider = "bkash" | "nagad" | "rocket";

export interface ParsedTransaction {
  provider: Provider;
  sender: string;
  message: string;
  amount_paisa: number;
  trx_id: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface TransactionLog {
  id: string;
  timestamp: number;
  provider: Provider;
  trx_id: string;
  amount_paisa: number;
  status: "sent" | "ignored" | "failed";
  error?: string;
}
