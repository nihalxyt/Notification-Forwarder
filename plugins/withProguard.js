const { withGradleProperties, withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withProguard(config) {
  config = withGradleProperties(config, (config) => {
    const props = config.modResults;

    const setProperty = (key, value) => {
      const existing = props.find(
        (p) => p.type === "property" && p.key === key
      );
      if (!existing) {
        props.push({ type: "property", key, value });
      } else {
        existing.value = value;
      }
    };

    setProperty("android.enableProguardInReleaseBuilds", "true");
    setProperty("newArchEnabled", "true");

    return config;
  });

  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const gradlePropsPath = path.join(
        config.modRequest.platformProjectRoot,
        "gradle.properties"
      );

      let content = "";
      if (fs.existsSync(gradlePropsPath)) {
        content = fs.readFileSync(gradlePropsPath, "utf-8");
      }

      if (content.includes("newArchEnabled=")) {
        content = content.replace(
          /newArchEnabled\s*=\s*.*/g,
          "newArchEnabled=true"
        );
      } else {
        content += "\nnewArchEnabled=true\n";
      }

      if (!content.includes("android.enableProguardInReleaseBuilds=")) {
        content += "android.enableProguardInReleaseBuilds=true\n";
      }

      fs.writeFileSync(gradlePropsPath, content, "utf-8");

      return config;
    },
  ]);

  return config;
}

module.exports = withProguard;
