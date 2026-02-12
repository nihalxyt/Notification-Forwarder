import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Switch,
  ScrollView,
  Linking,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import { useApp } from "@/lib/app-context";

const C = Colors.light;

function SettingItem({
  icon,
  iconBg,
  iconColor,
  title,
  desc,
  onPress,
  right,
  delay,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  desc: string;
  onPress?: () => void;
  right?: React.ReactNode;
  delay: number;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(250).delay(delay)}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [
          styles.settingItem,
          { opacity: onPress ? (pressed ? 0.7 : 1) : 1 },
        ]}
      >
        <View style={[styles.settingIconWrap, { backgroundColor: iconBg }]}>
          <Feather name={icon as any} size={16} color={iconColor} />
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

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { debugMode, toggleDebug, clearLogs, deviceKey, sentCount, failedCount, logs } = useApp();
  const webTop = Platform.OS === "web" ? 67 : 0;
  const webBot = Platform.OS === "web" ? 34 : 0;

  const openNotificationAccess = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    if (Platform.OS === "android") {
      Linking.openSettings();
    } else {
      Alert.alert("Notification Access", "Open Notification Listener settings on your Android device to grant Paylite permission.");
    }
  };

  const openBattery = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    if (Platform.OS === "android") {
      Linking.openSettings();
    } else {
      Alert.alert("Battery Optimization", "Disable battery optimization for Paylite to ensure reliable background operation.");
    }
  };

  const handleToggleDebug = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    toggleDebug();
  };

  const handleClearLogs = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    Alert.alert("Clear Logs", "Remove all transaction logs?", [
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
        >
          <Ionicons name="close" size={22} color={C.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <Text style={styles.groupLabel}>Permissions</Text>
        <View style={styles.card}>
          <SettingItem
            icon="bell"
            iconBg={C.accentDim}
            iconColor={C.accent}
            title="Notification Listener"
            desc="Required to capture bKash, NAGAD, and Rocket payments"
            onPress={openNotificationAccess}
            delay={50}
          />
          <View style={styles.sep} />
          <SettingItem
            icon="battery-charging"
            iconBg={C.greenDim}
            iconColor={C.green}
            title="Battery Optimization"
            desc="Disable to keep Paylite active in the background"
            onPress={openBattery}
            delay={100}
          />
        </View>

        <Text style={styles.groupLabel}>Configuration</Text>
        <View style={styles.card}>
          <SettingItem
            icon="terminal"
            iconBg={C.blueDim}
            iconColor={C.blue}
            title="Debug Mode"
            desc="Output detailed logs to the console"
            delay={150}
            right={
              <Switch
                value={debugMode}
                onValueChange={handleToggleDebug}
                trackColor={{ false: C.surfaceLight, true: C.accentDim }}
                thumbColor={debugMode ? C.accent : C.textMuted}
              />
            }
          />
          <View style={styles.sep} />
          <SettingItem
            icon="trash-2"
            iconBg={C.redDim}
            iconColor={C.red}
            title="Clear Logs"
            desc={`Remove all ${logs.length} transaction records`}
            onPress={handleClearLogs}
            delay={200}
          />
        </View>

        <Text style={styles.groupLabel}>Setup Guide</Text>
        <Animated.View entering={FadeInDown.duration(250).delay(250)}>
          <View style={styles.guideCard}>
            <View style={styles.guideStep}>
              <View style={styles.guideNum}><Text style={styles.guideNumText}>1</Text></View>
              <Text style={styles.guideText}>Grant Notification Listener access in Android Settings</Text>
            </View>
            <View style={styles.guideStep}>
              <View style={styles.guideNum}><Text style={styles.guideNumText}>2</Text></View>
              <Text style={styles.guideText}>Disable Battery Optimization for Paylite</Text>
            </View>
            <View style={styles.guideStep}>
              <View style={styles.guideNum}><Text style={styles.guideNumText}>3</Text></View>
              <Text style={styles.guideText}>Enable Auto-Start (Xiaomi, Huawei, Oppo, Vivo, Realme)</Text>
            </View>
            <View style={styles.guideStep}>
              <View style={styles.guideNum}><Text style={styles.guideNumText}>4</Text></View>
              <Text style={styles.guideText}>Lock app in Recent Apps to prevent system from killing it</Text>
            </View>
          </View>
        </Animated.View>

        {deviceKey ? (
          <>
            <Text style={styles.groupLabel}>Device</Text>
            <Animated.View entering={FadeInDown.duration(250).delay(300)}>
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

        <Text style={styles.footerText}>Paylite v1.0.0</Text>
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
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: C.textPrimary,
    letterSpacing: -0.2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  groupLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: C.textMuted,
    textTransform: "uppercase" as const,
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
    overflow: "hidden" as const,
  },
  settingItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    padding: 13,
    gap: 11,
  },
  settingIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  settingBody: {
    flex: 1,
    gap: 2,
  },
  settingTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: C.textPrimary,
  },
  settingDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: C.textSecondary,
    lineHeight: 15,
  },
  sep: {
    height: 1,
    backgroundColor: C.divider,
    marginLeft: 58,
  },
  guideCard: {
    backgroundColor: C.surfaceCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 12,
  },
  guideStep: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: 10,
  },
  guideNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.accentDim,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  guideNumText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: C.accent,
  },
  guideText: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 17,
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
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  deviceLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: C.textMuted,
  },
  deviceVal: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: C.textPrimary,
    marginLeft: 20,
  },
  footerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: C.textMuted,
    textAlign: "center" as const,
    marginTop: 28,
  },
});
