const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

function addNotificationListenerService(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest.application?.[0];
    if (!app) return config;

    if (!app.service) app.service = [];
    if (!app.receiver) app.receiver = [];

    const hasNLS = app.service.some(
      (s) =>
        s.$?.["android:name"] === ".PaymentNotificationListenerService"
    );
    if (!hasNLS) {
      app.service.push({
        $: {
          "android:name": ".PaymentNotificationListenerService",
          "android:label": "Paylite Payment Listener",
          "android:permission":
            "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE",
          "android:exported": "false",
        },
        "intent-filter": [
          {
            action: [
              {
                $: {
                  "android:name":
                    "android.service.notification.NotificationListenerService",
                },
              },
            ],
          },
        ],
      });
    }

    const hasSMS = app.receiver.some(
      (r) => r.$?.["android:name"] === ".PaymentSmsReceiver"
    );
    if (!hasSMS) {
      app.receiver.push({
        $: {
          "android:name": ".PaymentSmsReceiver",
          "android:exported": "true",
          "android:permission": "android.permission.BROADCAST_SMS",
        },
        "intent-filter": [
          {
            $: { "android:priority": "999" },
            action: [
              {
                $: {
                  "android:name":
                    "android.provider.Telephony.SMS_RECEIVED",
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });

  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const pkg = config.android?.package || "com.paylite.app";
      const pkgPath = pkg.replace(/\./g, "/");

      const javaDir = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "java",
        pkgPath
      );

      if (!fs.existsSync(javaDir)) {
        fs.mkdirSync(javaDir, { recursive: true });
      }

      const sourceDir = path.join(
        projectRoot,
        "native-android-notification-listener"
      );

      const filesToCopy = [
        "PaymentNotificationListenerService.kt",
        "PaymentSmsReceiver.kt",
        "PayliteBridgeModule.kt",
      ];

      for (const fileName of filesToCopy) {
        const srcFile = path.join(sourceDir, fileName);
        const destFile = path.join(javaDir, fileName);

        if (fs.existsSync(srcFile)) {
          let content = fs.readFileSync(srcFile, "utf-8");
          content = content.replace(
            /^package\s+[\w.]+/m,
            `package ${pkg}`
          );
          fs.writeFileSync(destFile, content, "utf-8");
        }
      }

      return config;
    },
  ]);

  return config;
}

module.exports = addNotificationListenerService;
