import { useState, useRef } from "react";
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
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useApp } from "@/lib/app-context";
import { TransactionLog, Provider } from "@/lib/types";
import { simulateNotification } from "@/lib/notification-bridge";

const C = Colors.light;

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  const s = d.getSeconds().toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function formatAmount(paisa: number): string {
  return `${(paisa / 100).toFixed(2)} BDT`;
}

function providerColor(p: Provider): string {
  switch (p) {
    case "bkash":
      return "#E2136E";
    case "nagad":
      return "#F6921E";
    case "rocket":
      return "#8C3494";
  }
}

function providerLabel(p: Provider): string {
  switch (p) {
    case "bkash":
      return "bKash";
    case "nagad":
      return "NAGAD";
    case "rocket":
      return "Rocket";
  }
}

function statusColor(s: string): string {
  switch (s) {
    case "sent":
      return C.green;
    case "ignored":
      return C.yellow;
    case "failed":
      return C.red;
    default:
      return C.textSecondary;
  }
}

function statusBg(s: string): string {
  switch (s) {
    case "sent":
      return C.greenMuted;
    case "ignored":
      return C.yellowMuted;
    case "failed":
      return C.redMuted;
    default:
      return "transparent";
  }
}

function LogItem({ item }: { item: TransactionLog }) {
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.logItem}>
      <View style={styles.logRow}>
        <View
          style={[
            styles.providerBadge,
            { backgroundColor: providerColor(item.provider) + "22" },
          ]}
        >
          <Text
            style={[
              styles.providerText,
              { color: providerColor(item.provider) },
            ]}
          >
            {providerLabel(item.provider)}
          </Text>
        </View>
        <Text style={styles.logTime}>{formatTime(item.timestamp)}</Text>
      </View>
      <View style={styles.logRow}>
        <Text style={styles.logTrx} numberOfLines={1}>
          {item.trx_id}
        </Text>
        <Text style={styles.logAmount}>{formatAmount(item.amount_paisa)}</Text>
      </View>
      <View style={styles.logRow}>
        <View
          style={[styles.statusBadge, { backgroundColor: statusBg(item.status) }]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: statusColor(item.status) },
            ]}
          />
          <Text
            style={[styles.statusText, { color: statusColor(item.status) }]}
          >
            {item.status.toUpperCase()}
          </Text>
        </View>
        {item.error && (
          <Text style={styles.logError} numberOfLines={1}>
            {item.error}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const {
    isLoggedIn,
    isListening,
    tokenExpiry,
    deviceKey,
    logs,
    isLoading,
    loginError,
    performLogin,
    logout,
    toggleListening,
  } = useApp();
  const [inputKey, setInputKey] = useState(deviceKey);
  const [loggingIn, setLoggingIn] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const handleLogin = async () => {
    if (!inputKey.trim()) return;
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoggingIn(true);
    await performLogin(inputKey.trim());
    setLoggingIn(false);
  };

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    logout();
  };

  const handleToggleListening = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleListening();
  };

  const handleTestNotification = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const testMessages = [
      {
        sender: "bKash",
        message:
          "You have received Tk 500.00 from 01712345678. Fee Tk 0.00. Balance Tk 1,200.00. TrxID TEST" +
          Date.now().toString(36).toUpperCase() +
          " at 12/02/2026 10:30",
      },
      {
        sender: "NAGAD",
        message:
          "Money Received.\nAmount: Tk 300.00\nSender: 01812345678\nRef: N/A\nTxnID: TEST" +
          Date.now().toString(36).toUpperCase() +
          "\nBalance: Tk 800.00\n12/02/2026 10:30",
      },
      {
        sender: "16216",
        message:
          "Tk150.00 received from A/C:***789 Fee:Tk0, Your A/C Balance: Tk500.00 TxnId:" +
          Date.now().toString() +
          " Date:12-FEB-26 10:30:00 am.",
      },
    ];
    const msg = testMessages[Math.floor(Math.random() * testMessages.length)];
    simulateNotification(msg.sender, msg.message);
  };

  const tokenExpiryText = tokenExpiry
    ? new Date(tokenExpiry).toLocaleString()
    : "N/A";

  const isTokenValid = tokenExpiry ? Date.now() < tokenExpiry : false;

  if (isLoading && !loggingIn) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={C.teal} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + webTopInset,
          paddingBottom: insets.bottom + webBottomInset,
        },
      ]}
    >
      <StatusBar style="light" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons
            name="lightning-bolt"
            size={28}
            color={C.teal}
          />
          <Text style={styles.headerTitle}>Paylite</Text>
        </View>
        <Pressable
          onPress={() => router.push("/settings")}
          style={({ pressed }) => [
            styles.headerBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Feather name="settings" size={22} color={C.textSecondary} />
        </Pressable>
      </View>

      {!isLoggedIn ? (
        <Animated.View
          entering={FadeIn.duration(400)}
          style={styles.loginContainer}
        >
          <View style={styles.loginIconWrap}>
            <MaterialCommunityIcons
              name="shield-key-outline"
              size={48}
              color={C.teal}
            />
          </View>
          <Text style={styles.loginTitle}>Connect Your Device</Text>
          <Text style={styles.loginSubtitle}>
            Enter your device key to authenticate and start listening for
            payment notifications.
          </Text>

          <View style={styles.inputContainer}>
            <Feather
              name="key"
              size={18}
              color={C.textMuted}
              style={styles.inputIcon}
            />
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={inputKey}
              onChangeText={setInputKey}
              placeholder="Device Key"
              placeholderTextColor={C.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleLogin}
              editable={!loggingIn}
            />
          </View>

          {loginError && (
            <Animated.View entering={FadeInUp.duration(200)} style={styles.errorRow}>
              <Feather name="alert-circle" size={14} color={C.red} />
              <Text style={styles.errorText}>{loginError}</Text>
            </Animated.View>
          )}

          <Pressable
            onPress={handleLogin}
            disabled={loggingIn || !inputKey.trim()}
            style={({ pressed }) => [
              styles.loginBtn,
              {
                opacity: loggingIn || !inputKey.trim() ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
          >
            {loggingIn ? (
              <ActivityIndicator size="small" color={C.navy} />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color={C.navy} />
                <Text style={styles.loginBtnText}>Login & Start</Text>
              </>
            )}
          </Pressable>
        </Animated.View>
      ) : (
        <View style={styles.dashContainer}>
          <Animated.View
            entering={FadeInDown.duration(300).delay(100)}
            style={styles.statusCard}
          >
            <View style={styles.statusRow}>
              <View style={styles.statusItem}>
                <View style={styles.statusLabelRow}>
                  <View
                    style={[
                      styles.statusDotLg,
                      {
                        backgroundColor: isTokenValid ? C.green : C.red,
                      },
                    ]}
                  />
                  <Text style={styles.statusLabel}>Status</Text>
                </View>
                <Text
                  style={[
                    styles.statusValue,
                    { color: isTokenValid ? C.green : C.red },
                  ]}
                >
                  {isTokenValid ? "Authenticated" : "Token Expired"}
                </Text>
              </View>
              <View style={styles.statusDivider} />
              <View style={styles.statusItem}>
                <View style={styles.statusLabelRow}>
                  <Feather name="clock" size={12} color={C.textMuted} />
                  <Text style={styles.statusLabel}>Expiry</Text>
                </View>
                <Text style={styles.statusValue} numberOfLines={1}>
                  {tokenExpiryText}
                </Text>
              </View>
            </View>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(300).delay(200)}
            style={styles.controlRow}
          >
            <Pressable
              onPress={handleToggleListening}
              style={({ pressed }) => [
                styles.listenBtn,
                {
                  backgroundColor: isListening ? C.tealMuted : C.redMuted,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons
                name={isListening ? "radio" : "radio-outline"}
                size={22}
                color={isListening ? C.teal : C.red}
              />
              <Text
                style={[
                  styles.listenBtnText,
                  { color: isListening ? C.teal : C.red },
                ]}
              >
                {isListening ? "Listening" : "Paused"}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleTestNotification}
              style={({ pressed }) => [
                styles.testBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="zap" size={18} color={C.yellow} />
              <Text style={styles.testBtnText}>Test</Text>
            </Pressable>

            <Pressable
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.logoutBtn,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="log-out" size={18} color={C.red} />
            </Pressable>
          </Animated.View>

          <Animated.View
            entering={FadeInDown.duration(300).delay(300)}
            style={styles.logsSection}
          >
            <Text style={styles.logsTitle}>Recent Transactions</Text>
            {logs.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="inbox" size={36} color={C.textMuted} />
                <Text style={styles.emptyText}>
                  No transactions yet. Payment notifications will appear here.
                </Text>
              </View>
            ) : (
              <FlatList
                data={logs}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <LogItem item={item} />}
                scrollEnabled={logs.length > 0}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.logsList}
              />
            )}
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.navy,
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: C.textPrimary,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  loginContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    gap: 16,
    marginTop: -60,
  },
  loginIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: C.tealMuted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 8,
  },
  loginTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: C.textPrimary,
    textAlign: "center" as const,
  },
  loginSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.textSecondary,
    textAlign: "center" as const,
    lineHeight: 20,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: C.navyLight,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    width: "100%" as const,
    height: 52,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: C.textPrimary,
    height: "100%" as const,
  },
  errorRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.red,
  },
  loginBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    backgroundColor: C.teal,
    borderRadius: 14,
    height: 52,
    width: "100%" as const,
    marginTop: 4,
  },
  loginBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: C.navy,
  },
  dashContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  statusCard: {
    backgroundColor: C.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  statusItem: {
    flex: 1,
    gap: 6,
  },
  statusLabelRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  statusDotLg: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: C.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  statusValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: C.textPrimary,
  },
  statusDivider: {
    width: 1,
    height: 36,
    backgroundColor: C.border,
    marginHorizontal: 12,
  },
  controlRow: {
    flexDirection: "row" as const,
    gap: 10,
    marginBottom: 16,
  },
  listenBtn: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    height: 48,
    borderRadius: 14,
  },
  listenBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  testBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: C.yellowMuted,
  },
  testBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: C.yellow,
  },
  logoutBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: C.redMuted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  logsSection: {
    flex: 1,
  },
  logsTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: C.textSecondary,
    marginBottom: 10,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  emptyState: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 12,
    paddingBottom: 80,
  },
  emptyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.textMuted,
    textAlign: "center" as const,
    lineHeight: 20,
    paddingHorizontal: 40,
  },
  logsList: {
    gap: 8,
    paddingBottom: 20,
  },
  logItem: {
    backgroundColor: C.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    gap: 8,
  },
  logRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  providerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  providerText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  logTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textMuted,
  },
  logTrx: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: C.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  logAmount: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: C.teal,
  },
  statusBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.5,
  },
  logError: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: C.textMuted,
    flex: 1,
    textAlign: "right" as const,
    marginLeft: 8,
  },
});
