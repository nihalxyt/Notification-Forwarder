const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

function addSmsReceiver(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest.application?.[0];
    if (!app) return config;

    if (!app.receiver) app.receiver = [];

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
        "PaymentSmsReceiver.kt",
        "PayliteBridgeModule.kt",
        "PayliteBridgePackage.kt",
        "SmsUploadWorker.kt",
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

      const mainAppPath = path.join(javaDir, "MainApplication.kt");
      if (fs.existsSync(mainAppPath)) {
        let mainApp = fs.readFileSync(mainAppPath, "utf-8");

        if (!mainApp.includes("PayliteBridgePackage")) {
          const addLine = `            add(PayliteBridgePackage())`;

          if (mainApp.includes(".packages.apply {")) {
            mainApp = mainApp.replace(
              /\.packages\.apply\s*\{/,
              `.packages.apply {\n${addLine}`
            );
          } else if (mainApp.includes("PackageList(this).packages")) {
            mainApp = mainApp.replace(
              /PackageList\(this\)\.packages/,
              `PackageList(this).packages.toMutableList().apply { add(PayliteBridgePackage()) }`
            );
          }

          fs.writeFileSync(mainAppPath, mainApp, "utf-8");
        }
      }

      const buildGradlePath = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "build.gradle"
      );

      if (fs.existsSync(buildGradlePath)) {
        let buildGradle = fs.readFileSync(buildGradlePath, "utf-8");

        if (!buildGradle.includes("work-runtime")) {
          buildGradle = buildGradle.replace(
            /dependencies\s*\{/,
            `dependencies {\n    implementation "androidx.work:work-runtime-ktx:2.9.0"`
          );
          fs.writeFileSync(buildGradlePath, buildGradle, "utf-8");
        }
      }

      return config;
    },
  ]);

  return config;
}

module.exports = addSmsReceiver;
