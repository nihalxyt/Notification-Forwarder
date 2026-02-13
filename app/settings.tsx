import { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  Linking,
  Platform,
  Alert,
  PermissionsAndroid,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "../constants/colors";
import { useApp } from "../lib/app-context";

const C = Colors.light;

function SettingItem({
  icon,
  iconSet,
  iconBg,
  iconColor,
  title,
  desc,
  onPress,
  right,
  delay,
}: {
  icon: string;
  iconSet?: "feather" | "material" | "ionicons";
  iconBg: string;
  iconColor: string;
  title: string;
  desc: string;
  onPress?: () => void;
  right?: React.ReactNode;
  delay: number;
}) {
  const IconComponent = iconSet === "material" ? MaterialCommunityIcons : iconSet === "ionicons" ? Ionicons : Feather;

  return (
    <Animated.View entering={FadeInDown.duration(220).delay(delay)}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [
          styles.settingItem,
          { opacity: onPress ? (pressed ? 0.7 : 1) : 1 },
        ]}
      >
        <View style={[styles.settingIconWrap, { backgroundColor: iconBg }]}>
          <IconComponent name={icon as any} size={16} color={iconColor} />
        </View>
        <View style={styles.settingBody}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingDesc}>{desc}</Text>
        </View>
        {right || (onPress ? <Feather name="chevron-right" size={16} color={C.textMuted} /> : null)}
      </Pressable>
    </Animated.View>
  );
}

function StatusDot({ granted }: { granted: boolean }) {
  return (
    <View style={[styles.permDot, { backgroundColor: granted ? C.green : C.red }]} />
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { clearLogs, deviceKey, logs, pendingCount } = useApp();
  const webTop = Platform.OS === "web" ? 67 : 0;
  const webBot = Platform.OS === "web" ? 34 : 0;
  const isAndroid = Platform.OS === "android";
  const androidApiLevel = typeof Platform.Version === "string" ? parseInt(Platform.Version, 10) : Platform.Version;

  const [smsGranted, setSmsGranted] = useState(false);
  const [notificationGranted, setNotificationGranted] = useState(Platform.OS !== "android");

  const checkPermissions = useCallback(async () => {
    if (!isAndroid) return;
    try {
      const [receiveSms, readSms] = await Promise.all([
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS),
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS),
      ]);
      setSmsGranted(receiveSms && readSms);

      if (androidApiLevel >= 33) {
        const notif = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        setNotificationGranted(notif);
      } else {
        setNotificationGranted(true);
      }
    } catch {
      setSmsGranted(false);
      setNotificationGranted(false);
    }
  }, [androidApiLevel, isAndroid]);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  const requestSmsPermission = async () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}

    if (!isAndroid) {
      Alert.alert("SMS Permission", "SMS reading is only available on Android devices.");
      return;
    }

    try {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
        PermissionsAndroid.PERMISSIONS.READ_SMS,
      ]);

      const receiveResult = granted[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS];
      const readResult = granted[PermissionsAndroid.PERMISSIONS.READ_SMS];
      const fullyGranted =
        receiveResult === PermissionsAndroid.RESULTS.GRANTED &&
        readResult === PermissionsAndroid.RESULTS.GRANTED;

      if (fullyGranted) {
        setSmsGranted(true);
      } else if (
        receiveResult === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
        readResult === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
      ) {
        Alert.alert(
          "Permission Required",
          "SMS permission was denied. Please enable it from app settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
      } else {
        setSmsGranted(false);
      }
    } catch {
      Alert.alert("Error", "Could not request SMS permission. Please try from your device settings.");
    }
  };

  const requestNotificationPermission = async () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}

    if (!isAndroid) return;

    if (androidApiLevel < 33) {
      setNotificationGranted(true);
      return;
    }

    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        setNotificationGranted(true);
      } else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        Alert.alert(
          "Permission Required",
          "Notification permission was denied. Please enable it from app settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
      } else {
        setNotificationGranted(false);
      }
    } catch {
      Alert.alert("Error", "Could not request notification permission.");
    }
  };

  const handleClearLogs = () => {
    if (logs.length === 0) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    Alert.alert("Clear Logs", `Remove all ${logs.length} transaction records?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: clearLogs },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTop, paddingBottom: insets.bottom + webBot }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
          testID="close-settings"
        >
          <Ionicons name="close" size={22} color={C.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        <Text style={styles.groupLabel}>Permissions</Text>
        <View style={styles.card}>
          <SettingItem
            icon="message-square"
            iconBg={C.blueDim}
            iconColor={C.blue}
            title="SMS Read Access"
            desc={smsGranted ? "Granted - reading bKash, NAGAD, Rocket SMS" : "Required to read payment SMS"}
            onPress={requestSmsPermission}
            delay={40}
            right={<StatusDot granted={smsGranted} />}
          />
          <View style={styles.sep} />
          <SettingItem
            icon="bell"
            iconBg={C.accentDim}
            iconColor={C.accent}
            title="Notification Permission"
            desc={notificationGranted ? "Granted - status notification active" : "Allow status notification"}
            onPress={requestNotificationPermission}
            delay={80}
            right={<StatusDot granted={notificationGranted} />}
          />
        </View>

        {pendingCount > 0 ? (
          <>
            <Text style={styles.groupLabel}>Offline Queue</Text>
            <Animated.View entering={FadeInDown.duration(220).delay(160)}>
              <View style={styles.offlineCard}>
                <Feather name="wifi-off" size={14} color={C.amber} />
                <Text style={styles.offlineText}>
                  {pendingCount} transaction{pendingCount > 1 ? "s" : ""} waiting to be sent
                </Text>
              </View>
            </Animated.View>
          </>
        ) : null}

        <Text style={styles.groupLabel}>Data</Text>
        <View style={styles.card}>
          <SettingItem
            icon="trash-2"
            iconBg={C.redDim}
            iconColor={C.red}
            title="Clear Logs"
            desc={logs.length > 0 ? `Remove all ${logs.length} transaction records` : "No records to clear"}
            onPress={logs.length > 0 ? handleClearLogs : undefined}
            delay={200}
          />
        </View>

        <Text style={styles.groupLabel}>Setup Guide</Text>
        <Animated.View entering={FadeInDown.duration(220).delay(240)}>
          <View style={styles.guideCard}>
            <View style={styles.guideStep}>
              <View style={styles.guideNum}><Text style={styles.guideNumText}>1</Text></View>
              <Text style={styles.guideText}>Grant SMS Read permission to capture payment SMS</Text>
            </View>
            <View style={styles.guideStep}>
              <View style={styles.guideNum}><Text style={styles.guideNumText}>2</Text></View>
              <Text style={styles.guideText}>Allow Notification permission for status updates</Text>
            </View>
            <View style={styles.guideStep}>
              <View style={styles.guideNum}><Text style={styles.guideNumText}>3</Text></View>
              <Text style={styles.guideText}>On Xiaomi/Huawei/Oppo: Enable Auto-Start for Paylite</Text>
            </View>
          </View>
        </Animated.View>

        {deviceKey ? (
          <>
            <Text style={styles.groupLabel}>Device</Text>
            <Animated.View entering={FadeInDown.duration(220).delay(280)}>
              <View style={styles.deviceCard}>
                <View style={styles.deviceRow}>
                  <Feather name="smartphone" size={14} color={C.textMuted} />
                  <Text style={styles.deviceLabel}>Device Key</Text>
                </View>
                <Text style={styles.deviceVal} numberOfLines={1}>
                  {deviceKey.slice(0, 8)}{"***"}{deviceKey.slice(-4)}
                </Text>
              </View>
            </Animated.View>
          </>
        ) : null}

        <Text style={styles.footerText}>Powered by Nihal X</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: C.textPrimary,
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  groupLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: C.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 8,
    marginLeft: 2,
  },
  card: {
    backgroundColor: C.surfaceCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  settingIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  settingBody: {
    flex: 1,
    gap: 2,
  },
  settingTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: C.textPrimary,
    letterSpacing: -0.1,
  },
  settingDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 11.5,
    color: C.textSecondary,
    lineHeight: 16,
    letterSpacing: 0.05,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: C.divider,
    marginLeft: 60,
  },
  permDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 2,
  },
  offlineCard: {
    backgroundColor: C.amberDim,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 176, 32, 0.15)",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  offlineText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: C.amber,
    flex: 1,
    letterSpacing: -0.1,
  },
  guideCard: {
    backgroundColor: C.surfaceCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 14,
  },
  guideStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  guideNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  guideNumText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: C.accent,
  },
  guideText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12.5,
    color: C.textSecondary,
    lineHeight: 18,
    letterSpacing: 0.05,
  },
  deviceCard: {
    backgroundColor: C.surfaceCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 4,
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  deviceLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: C.textMuted,
    letterSpacing: 0.2,
  },
  deviceVal: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: C.textPrimary,
    marginLeft: 20,
    letterSpacing: -0.2,
  },
  footerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: C.textMuted,
    textAlign: "center",
    marginTop: 28,
    letterSpacing: 0.3,
  },
});
