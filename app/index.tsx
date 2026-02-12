import { useState, useRef, useCallback, memo } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  FlatList,
  Platform,
  ActivityIndicator,
  Keyboard,
  Dimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useApp } from "@/lib/app-context";
import { TransactionLog, Provider } from "@/lib/types";

const C = Colors.light;
const { width: SCREEN_W } = Dimensions.get("window");

function formatTime(ts: number): string {
  try {
    const d = new Date(ts);
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  } catch {
    return "--:--";
  }
}

function formatDate(ts: number): string {
  try {
    const d = new Date(ts);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[d.getMonth()]} ${d.getDate()}`;
  } catch {
    return "";
  }
}

function formatAmount(paisa: number): string {
  const tk = (paisa / 100).toFixed(2);
  return `${tk}`;
}

function providerColor(p: Provider): string {
  switch (p) {
    case "bkash": return C.bkash;
    case "nagad": return C.nagad;
    case "rocket": return C.rocket;
  }
}

function providerIcon(p: Provider): string {
  switch (p) {
    case "bkash": return "cellphone";
    case "nagad": return "cellphone-wireless";
    case "rocket": return "rocket-launch-outline";
  }
}

function providerLabel(p: Provider): string {
  switch (p) {
    case "bkash": return "bKash";
    case "nagad": return "NAGAD";
    case "rocket": return "Rocket";
  }
}

const LogItem = memo(function LogItem({ item }: { item: TransactionLog }) {
  const color = providerColor(item.provider);
  const isSent = item.status === "sent";
  const isFailed = item.status === "failed";

  return (
    <View style={styles.logItem}>
      <View style={[styles.logIconWrap, { backgroundColor: color + "18" }]}>
        <MaterialCommunityIcons
          name={providerIcon(item.provider) as any}
          size={18}
          color={color}
        />
      </View>
      <View style={styles.logInfo}>
        <View style={styles.logTopRow}>
          <Text style={styles.logProvider}>{providerLabel(item.provider)}</Text>
          <Text style={[styles.logAmountTk, isSent && { color: C.green }]}>
            {isFailed ? "-" : "+"}{formatAmount(item.amount_paisa)}
          </Text>
        </View>
        <View style={styles.logBottomRow}>
          <Text style={styles.logTrxId} numberOfLines={1}>{item.trx_id}</Text>
          <View style={styles.logMetaRight}>
            <View style={[
              styles.statusPill,
              {
                backgroundColor: isSent ? C.greenDim : isFailed ? C.redDim : C.amberDim,
              },
            ]}>
              <View style={[
                styles.statusDotSm,
                {
                  backgroundColor: isSent ? C.green : isFailed ? C.red : C.amber,
                },
              ]} />
              <Text style={[
                styles.statusPillText,
                {
                  color: isSent ? C.green : isFailed ? C.red : C.amber,
                },
              ]}>
                {item.status === "sent" ? "OK" : item.status === "failed" ? "ERR" : "DUP"}
              </Text>
            </View>
            <Text style={styles.logTime}>{formatTime(item.timestamp)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
});

const renderLogItem = ({ item }: { item: TransactionLog }) => <LogItem item={item} />;
const keyExtractor = (item: TransactionLog) => item.id;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const {
    isLoggedIn, isListening, tokenExpiry, deviceKey, logs,
    isLoading, loginError, sentCount, failedCount,
    performLogin, logout, toggleListening,
  } = useApp();
  const [inputKey, setInputKey] = useState(deviceKey);
  const [loggingIn, setLoggingIn] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const webTop = Platform.OS === "web" ? 67 : 0;
  const webBot = Platform.OS === "web" ? 34 : 0;

  const handleLogin = useCallback(async () => {
    if (!inputKey.trim()) return;
    Keyboard.dismiss();
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    setLoggingIn(true);
    await performLogin(inputKey.trim());
    setLoggingIn(false);
  }, [inputKey, performLogin]);

  const handleLogout = useCallback(() => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    logout();
  }, [logout]);

  const handleToggle = useCallback(() => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    toggleListening();
  }, [toggleListening]);

  const isTokenValid = tokenExpiry ? Date.now() < tokenExpiry : false;

  if (isLoading && !loggingIn) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTop }]}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <View style={styles.loadingGlow}>
            <MaterialCommunityIcons name="lightning-bolt" size={32} color={C.accent} />
          </View>
          <ActivityIndicator size="small" color={C.accent} style={{ marginTop: 20 }} />
        </View>
      </View>
    );
  }

  if (!isLoggedIn) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTop, paddingBottom: insets.bottom + webBot }]}>
        <StatusBar style="light" />
        <View style={styles.loginHeader}>
          <View style={{ width: 40 }} />
          <View style={styles.logoRow}>
            <MaterialCommunityIcons name="lightning-bolt" size={22} color={C.accent} />
            <Text style={styles.logoText}>Paylite</Text>
          </View>
          <Pressable onPress={() => router.push("/settings")} style={styles.iconBtn} testID="settings-btn">
            <Feather name="settings" size={20} color={C.textMuted} />
          </Pressable>
        </View>

        <Animated.View entering={FadeIn.duration(500)} style={styles.loginBody}>
          <View style={styles.loginHeroGlow}>
            <LinearGradient
              colors={["rgba(0,229,191,0.08)", "transparent"]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />
            <MaterialCommunityIcons name="shield-lock-outline" size={52} color={C.accent} />
          </View>

          <Text style={styles.loginH1}>Authenticate</Text>
          <Text style={styles.loginSub}>
            Enter your device key to start capturing payment notifications automatically.
          </Text>

          <View style={styles.inputWrap}>
            <Feather name="key" size={16} color={C.textMuted} />
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={inputKey}
              onChangeText={setInputKey}
              placeholder="Enter device key"
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleLogin}
              editable={!loggingIn}
              testID="device-key-input"
            />
          </View>

          {loginError ? (
            <Animated.View entering={FadeIn.duration(200)} style={styles.errRow}>
              <Ionicons name="alert-circle" size={14} color={C.red} />
              <Text style={styles.errText}>{loginError}</Text>
            </Animated.View>
          ) : null}

          <Pressable
            onPress={handleLogin}
            disabled={loggingIn || !inputKey.trim()}
            style={({ pressed }) => [
              styles.loginBtn,
              { opacity: loggingIn || !inputKey.trim() ? 0.4 : pressed ? 0.85 : 1 },
            ]}
            testID="login-btn"
          >
            {loggingIn ? (
              <ActivityIndicator size="small" color={C.bg} />
            ) : (
              <>
                <Ionicons name="arrow-forward" size={18} color={C.bg} />
                <Text style={styles.loginBtnText}>Connect</Text>
              </>
            )}
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTop, paddingBottom: insets.bottom + webBot }]}>
      <StatusBar style="light" />

      <View style={styles.dashHeader}>
        <View style={styles.logoRow}>
          <MaterialCommunityIcons name="lightning-bolt" size={22} color={C.accent} />
          <Text style={styles.logoText}>Paylite</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push("/settings")} style={styles.iconBtn} testID="settings-btn">
            <Feather name="settings" size={20} color={C.textSecondary} />
          </Pressable>
          <Pressable onPress={handleLogout} style={styles.iconBtn} testID="logout-btn">
            <Feather name="log-out" size={18} color={C.red} />
          </Pressable>
        </View>
      </View>

      <Animated.View entering={FadeInDown.duration(300).delay(50)} style={styles.statusStrip}>
        <Pressable
          onPress={handleToggle}
          style={({ pressed }) => [
            styles.listenChip,
            { backgroundColor: isListening ? C.accentDim : C.redDim, opacity: pressed ? 0.8 : 1 },
          ]}
          testID="listen-btn"
        >
          <View style={[styles.pulseDot, { backgroundColor: isListening ? C.green : C.red }]} />
          <Text style={[styles.listenChipText, { color: isListening ? C.accent : C.red }]}>
            {isListening ? "Active" : "Paused"}
          </Text>
        </Pressable>

        <View style={styles.tokenChip}>
          <Feather name="shield" size={12} color={isTokenValid ? C.green : C.red} />
          <Text style={[styles.tokenChipText, { color: isTokenValid ? C.green : C.red }]}>
            {isTokenValid ? "Secured" : "Expired"}
          </Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(300).delay(120)} style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{logs.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCard, styles.statCardMid]}>
          <Text style={[styles.statNum, { color: C.green }]}>{sentCount}</Text>
          <Text style={styles.statLabel}>Sent</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: C.red }]}>{failedCount}</Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(300).delay(180)} style={styles.logsSection}>
        <Text style={styles.sectionLabel}>Activity</Text>
        {logs.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Feather name="inbox" size={32} color={C.textMuted} />
            <Text style={styles.emptyText}>Waiting for payment notifications...</Text>
          </View>
        ) : (
          <FlatList
            data={logs}
            keyExtractor={keyExtractor}
            renderItem={renderLogItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.logsList}
            removeClippedSubviews={true}
            maxToRenderPerBatch={8}
            windowSize={5}
            scrollEnabled={logs.length > 0}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  loadingGlow: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.accentDim,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },

  loginHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  logoRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  logoText: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: C.textPrimary,
    letterSpacing: -0.3,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },

  loginBody: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    gap: 16,
    marginTop: -50,
  },
  loginHeroGlow: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    overflow: "hidden" as const,
    marginBottom: 8,
  },
  loginH1: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: C.textPrimary,
    letterSpacing: -0.5,
  },
  loginSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.textSecondary,
    textAlign: "center" as const,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  inputWrap: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    width: "100%" as const,
    height: 50,
    paddingHorizontal: 16,
    gap: 12,
    marginTop: 4,
  },
  input: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: C.textPrimary,
    height: "100%" as const,
  },
  errRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  errText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.red,
  },
  loginBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    backgroundColor: C.accent,
    borderRadius: 14,
    height: 50,
    width: "100%" as const,
    marginTop: 4,
  },
  loginBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: C.bg,
    letterSpacing: -0.2,
  },

  dashHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerActions: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },

  statusStrip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  listenChip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  listenChipText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    letterSpacing: 0.2,
  },
  tokenChip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.surfaceCard,
    borderWidth: 1,
    borderColor: C.border,
  },
  tokenChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    letterSpacing: 0.2,
  },

  statsRow: {
    flexDirection: "row" as const,
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.surfaceCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 14,
    alignItems: "center" as const,
  },
  statCardMid: {
    borderColor: C.borderLight,
  },
  statNum: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: C.textPrimary,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: C.textMuted,
    marginTop: 2,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },

  logsSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: C.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 10,
    paddingBottom: 60,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.textMuted,
    textAlign: "center" as const,
  },
  logsList: {
    gap: 6,
    paddingBottom: 16,
  },

  logItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: C.surfaceCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    gap: 10,
  },
  logIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  logInfo: {
    flex: 1,
    gap: 4,
  },
  logTopRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  logProvider: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: C.textPrimary,
  },
  logAmountTk: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: C.textPrimary,
    letterSpacing: -0.3,
  },
  logBottomRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  logTrxId: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: C.textMuted,
    flex: 1,
    marginRight: 8,
  },
  logMetaRight: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  statusPill: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusDotSm: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  statusPillText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 0.3,
  },
  logTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: C.textMuted,
  },
});
