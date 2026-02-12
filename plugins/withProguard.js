const { withGradleProperties } = require("expo/config-plugins");

function withProguard(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;

    const proguardProp = props.find(
      (p) => p.type === "property" && p.key === "android.enableProguardInReleaseBuilds"
    );
    if (!proguardProp) {
      props.push({
        type: "property",
        key: "android.enableProguardInReleaseBuilds",
        value: "true",
      });
    } else {
      proguardProp.value = "true";
    }

    return config;
  });
}

module.exports = withProguard;
