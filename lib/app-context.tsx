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
import {
  setLogCallback,
  setDebugMode,
} from "./notification-bridge";
import { cleanExpiredEntries } from "./dedupe";

const LOGS_KEY = "paylite_logs";
const DEBUG_KEY = "paylite_debug";
const MAX_LOGS = 10;

interface AppContextValue {
  isLoggedIn: boolean;
  isListening: boolean;
  tokenExpiry: number | null;
  deviceKey: string;
  logs: TransactionLog[];
  debugMode: boolean;
  isLoading: boolean;
  loginError: string | null;
  performLogin: (key: string) => Promise<boolean>;
  logout: () => Promise<void>;
  toggleListening: () => void;
  toggleDebug: () => Promise<void>;
  clearLogs: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
  const [deviceKey, setDeviceKey] = useState("");
  const [logs, setLogs] = useState<TransactionLog[]>([]);
  const [debugMode, setDebugModeState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  const addLog = useCallback((log: TransactionLog) => {
    setLogs((prev) => {
      const updated = [log, ...prev].slice(0, MAX_LOGS);
      AsyncStorage.setItem(LOGS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  useEffect(() => {
    setLogCallback(addLog);
  }, [addLog]);

  useEffect(() => {
    (async () => {
      try {
        const [storedKey, token, expiry, storedLogs, storedDebug] =
          await Promise.all([
            getDeviceKey(),
            getToken(),
            getTokenExpiry(),
            AsyncStorage.getItem(LOGS_KEY),
            AsyncStorage.getItem(DEBUG_KEY),
          ]);

        if (storedKey) setDeviceKey(storedKey);
        if (token) {
          setIsLoggedIn(true);
          setTokenExpiry(expiry);
        }
        if (storedLogs) {
          setLogs(JSON.parse(storedLogs));
        }
        if (storedDebug === "true") {
          setDebugModeState(true);
          setDebugMode(true);
        }

        cleanExpiredEntries();
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
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    setIsListening((prev) => !prev);
  }, []);

  const toggleDebug = useCallback(async () => {
    setDebugModeState((prev) => {
      const next = !prev;
      setDebugMode(next);
      AsyncStorage.setItem(DEBUG_KEY, next.toString());
      return next;
    });
  }, []);

  const clearLogs = useCallback(async () => {
    setLogs([]);
    await AsyncStorage.removeItem(LOGS_KEY);
  }, []);

  const value = useMemo(
    () => ({
      isLoggedIn,
      isListening,
      tokenExpiry,
      deviceKey,
      logs,
      debugMode,
      isLoading,
      loginError,
      performLogin,
      logout,
      toggleListening,
      toggleDebug,
      clearLogs,
    }),
    [
      isLoggedIn,
      isListening,
      tokenExpiry,
      deviceKey,
      logs,
      debugMode,
      isLoading,
      loginError,
      performLogin,
      logout,
      toggleListening,
      toggleDebug,
      clearLogs,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
