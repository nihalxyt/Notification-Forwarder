import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { TransactionLog } from "./types";
import {
  getDeviceKey,
  saveDeviceKey,
  getToken,
  getTokenExpiry,
  clearAuth,
} from "./secure-storage";
import { login } from "./api-client";
import { setLogCallback, startSmsListener, initOfflineQueue } from "./notification-bridge";
import { getPendingCount } from "./offline-queue";
import { cleanExpiredEntries } from "./dedupe";

const LOGS_KEY = "paylite_logs";
const MAX_LOGS = 50;

interface AppContextValue {
  isLoggedIn: boolean;
  tokenExpiry: number | null;
  deviceKey: string;
  logs: TransactionLog[];
  isLoading: boolean;
  loginError: string | null;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  performLogin: (key: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearLogs: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
  const [deviceKey, setDeviceKey] = useState("");
  const [logs, setLogs] = useState<TransactionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const sentCount = useMemo(
    () => logs.filter((l) => l.status === "sent").length,
    [logs]
  );
  const failedCount = useMemo(
    () => logs.filter((l) => l.status === "failed").length,
    [logs]
  );

  const addLog = useCallback((log: TransactionLog) => {
    setLogs((prev) => {
      const updated = [log, ...prev].slice(0, MAX_LOGS);
      AsyncStorage.setItem(LOGS_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
    getPendingCount().then(setPendingCount).catch(() => {});
  }, []);

  useEffect(() => {
    setLogCallback(addLog);
  }, [addLog]);

  useEffect(() => {
    if (isLoggedIn) {
      startSmsListener();
      initOfflineQueue();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    (async () => {
      try {
        const [storedKey, token, expiry, storedLogs] =
          await Promise.all([
            getDeviceKey(),
            getToken(),
            getTokenExpiry(),
            AsyncStorage.getItem(LOGS_KEY),
          ]);

        if (storedKey) setDeviceKey(storedKey);
        if (token) {
          setIsLoggedIn(true);
          setTokenExpiry(expiry);
        }
        if (storedLogs) {
          try { setLogs(JSON.parse(storedLogs)); } catch {}
        }

        const pending = await getPendingCount();
        setPendingCount(pending);

        cleanExpiredEntries().catch(() => {});
      } catch (e) {
        console.error("Init error:", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const performLogin = useCallback(async (key: string): Promise<boolean> => {
    setLoginError(null);
    setIsLoading(true);
    try {
      await saveDeviceKey(key);
      setDeviceKey(key);
      const result = await login(key);
      if (result.success) {
        setIsLoggedIn(true);
        setTokenExpiry(result.expiry);
        setIsLoading(false);
        return true;
      } else {
        setLoginError(result.error || "Login failed");
        setIsLoading(false);
        return false;
      }
    } catch (e: any) {
      setLoginError(e.message || "Login failed");
      setIsLoading(false);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    await clearAuth();
    setIsLoggedIn(false);
    setTokenExpiry(null);
  }, []);

  const clearLogs = useCallback(async () => {
    setLogs([]);
    await AsyncStorage.removeItem(LOGS_KEY).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({
      isLoggedIn,
      tokenExpiry,
      deviceKey,
      logs,
      isLoading,
      loginError,
      sentCount,
      failedCount,
      pendingCount,
      performLogin,
      logout,
      clearLogs,
    }),
    [
      isLoggedIn, tokenExpiry, deviceKey, logs,
      isLoading, loginError, sentCount, failedCount, pendingCount,
      performLogin, logout, clearLogs,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
