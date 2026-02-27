import { Platform, PermissionsAndroid, Alert, Linking } from "react-native";

const androidApiLevel = typeof Platform.Version === "string" ? parseInt(Platform.Version, 10) : Platform.Version;

export async function requestAllPermissions(): Promise<{
  sms: boolean;
  notification: boolean;
}> {
  if (Platform.OS !== "android") {
    return { sms: false, notification: true };
  }

  let smsGranted = false;
  let notificationGranted = true;

  try {
    const smsResult = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      PermissionsAndroid.PERMISSIONS.READ_SMS,
    ]);

    smsGranted =
      smsResult[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED &&
      smsResult[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED;

    if (!smsGranted) {
      const neverAgain =
        smsResult[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
        smsResult[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;

      if (neverAgain) {
        Alert.alert(
          "SMS Permission Required",
          "Paylite needs SMS permission to capture bKash, NAGAD & Rocket payments. Please enable it in Settings.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
      }
    }
  } catch (e) {
    console.warn("[Paylite] SMS permission request failed:", e);
  }

  if (androidApiLevel >= 33) {
    try {
      const notifResult = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      notificationGranted = notifResult === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      console.warn("[Paylite] Notification permission request failed:", e);
    }
  }

  return { sms: smsGranted, notification: notificationGranted };
}

export async function checkAllPermissions(): Promise<{
  sms: boolean;
  notification: boolean;
}> {
  if (Platform.OS !== "android") {
    return { sms: false, notification: true };
  }

  try {
    const [receiveSms, readSms] = await Promise.all([
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS),
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS),
    ]);

    let notificationGranted = true;
    if (androidApiLevel >= 33) {
      notificationGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
    }

    return {
      sms: receiveSms && readSms,
      notification: notificationGranted,
    };
  } catch {
    return { sms: false, notification: false };
  }
}
