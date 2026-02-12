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

function SettingRow({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  rightElement,
  delay,
}: {
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  delay: number;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(300).delay(delay)}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [
          styles.settingRow,
          { opacity: onPress ? (pressed ? 0.7 : 1) : 1 },
        ]}
      >
        <View
          style={[
            styles.settingIcon,
            { backgroundColor: iconColor + "22" },
          ]}
        >
          <Feather name={icon as any} size={18} color={iconColor} />
        </View>
        <View style={styles.settingContent}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
        {rightElement || (
          onPress ? (
            <Feather name="chevron-right" size={18} color={C.textMuted} />
          ) : null
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { debugMode, toggleDebug, clearLogs, deviceKey } = useApp();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const openNotificationAccess = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === "android") {
      Linking.openSettings();
    } else {
      Alert.alert(
        "Notification Access",
        "On Android, this opens your Notification Listener settings. This feature requires an Android device with the native listener module installed."
      );
    }
  };

  const openBatteryOptimization = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === "android") {
      Linking.openSettings();
    } else {
      Alert.alert(
        "Battery Optimization",
        "On Android, this opens your Battery Optimization settings to disable optimization for Paylite. This ensures the app runs reliably in the background."
      );
    }
  };

  const handleToggleDebug = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleDebug();
  };

  const handleClearLogs = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearLogs();
  };

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
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="close" size={24} color={C.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Android Permissions</Text>
        <View style={styles.card}>
          <SettingRow
            icon="bell"
            iconColor={C.teal}
            title="Notification Access"
            subtitle="Required to listen for payment notifications from bKash, NAGAD, and Rocket."
            onPress={openNotificationAccess}
            delay={100}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="battery-charging"
            iconColor={C.green}
            title="Battery Optimization"
            subtitle="Disable battery optimization to keep Paylite running reliably in the background."
            onPress={openBatteryOptimization}
            delay={200}
          />
        </View>

        <Text style={styles.sectionTitle}>Auto-Start</Text>
        <Animated.View entering={FadeInDown.duration(300).delay(300)}>
          <View style={styles.card}>
            <View style={styles.autoStartRow}>
              <View
                style={[
                  styles.settingIcon,
                  { backgroundColor: C.yellowMuted },
                ]}
              >
                <MaterialCommunityIcons
                  name="rocket-launch-outline"
                  size={18}
                  color={C.yellow}
                />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>Enable Auto-Start</Text>
                <Text style={styles.settingSubtitle}>
                  On some Android devices (Xiaomi, Huawei, Oppo, Vivo), you
                  need to manually enable auto-start for Paylite in your
                  device's security or app management settings. Go to Settings
                  {">"} Apps {">"} Manage Apps {">"} Paylite {">"} Auto-start.
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.card}>
          <SettingRow
            icon="terminal"
            iconColor="#A78BFA"
            title="Debug Logs"
            subtitle="Show detailed debug information in the console."
            delay={400}
            rightElement={
              <Switch
                value={debugMode}
                onValueChange={handleToggleDebug}
                trackColor={{ false: C.navyMid, true: C.tealMuted }}
                thumbColor={debugMode ? C.teal : C.textMuted}
              />
            }
          />
          <View style={styles.divider} />
          <SettingRow
            icon="trash-2"
            iconColor={C.red}
            title="Clear Transaction Logs"
            subtitle="Remove all recorded transaction logs from the device."
            onPress={handleClearLogs}
            delay={500}
          />
        </View>

        {deviceKey ? (
          <>
            <Text style={styles.sectionTitle}>Device</Text>
            <Animated.View entering={FadeInDown.duration(300).delay(600)}>
              <View style={styles.card}>
                <View style={styles.deviceRow}>
                  <Feather name="smartphone" size={16} color={C.textMuted} />
                  <Text style={styles.deviceKeyLabel}>Device Key</Text>
                </View>
                <Text style={styles.deviceKeyValue} numberOfLines={1}>
                  {deviceKey.slice(0, 8)}{"***"}
                  {deviceKey.slice(-4)}
                </Text>
              </View>
            </Animated.View>
          </>
        ) : null}

        <Animated.View entering={FadeInDown.duration(300).delay(700)}>
          <View style={styles.infoCard}>
            <Feather name="info" size={16} color={C.textMuted} />
            <Text style={styles.infoText}>
              Paylite requires a custom Android build with
              NotificationListenerService to receive payment notifications in
              the background. The test button on the home screen simulates
              incoming notifications for development.
            </Text>
          </View>
        </Animated.View>

        <Text style={styles.versionText}>Paylite v1.0.0</Text>
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  headerTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    color: C.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: C.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: C.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden" as const,
  },
  settingRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    padding: 14,
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  settingContent: {
    flex: 1,
    gap: 3,
  },
  settingTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: C.textPrimary,
  },
  settingSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 17,
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginLeft: 62,
  },
  autoStartRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    padding: 14,
    gap: 12,
  },
  deviceRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4,
  },
  deviceKeyLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: C.textMuted,
  },
  deviceKeyValue: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: C.textPrimary,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  infoCard: {
    flexDirection: "row" as const,
    gap: 10,
    backgroundColor: C.cardBg,
    borderRadius: 12,
    padding: 14,
    marginTop: 24,
    borderWidth: 1,
    borderColor: C.border,
  },
  infoText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 17,
    flex: 1,
  },
  versionText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: C.textMuted,
    textAlign: "center" as const,
    marginTop: 24,
  },
});
