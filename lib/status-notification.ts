import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

const CHANNEL_ID = "paylite_status";
const NOTIFICATION_ID = "paylite-listening";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: false,
    shouldShowList: false,
  }),
});

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Paylite Status",
      importance: Notifications.AndroidImportance.LOW,
      sound: undefined,
      vibrationPattern: [],
      enableVibrate: false,
      showBadge: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.SECRET,
    });
  } catch {}
}

export async function showListeningNotification(): Promise<void> {
  if (Platform.OS !== "android") return;

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    await ensureChannel();

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: "Paylite Active",
        body: "Listening for bKash, NAGAD & Rocket payments",
        sticky: true,
        autoDismiss: false,
        priority: Notifications.AndroidNotificationPriority.LOW,
        ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: null,
    });
  } catch (e) {
    console.log("[Paylite] Could not show status notification:", e);
  }
}

export async function dismissListeningNotification(): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
  } catch {}
}
