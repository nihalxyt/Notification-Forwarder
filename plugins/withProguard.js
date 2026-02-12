const { withGradleProperties } = require("expo/config-plugins");

function setGradleProperty(props, key, value) {
  const existing = props.find(
    (p) => p.type === "property" && p.key === key
  );
  if (!existing) {
    props.push({ type: "property", key, value });
  } else {
    existing.value = value;
  }
}

function withProguard(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults;

    setGradleProperty(props, "android.enableProguardInReleaseBuilds", "true");
    setGradleProperty(props, "newArchEnabled", "true");

    return config;
  });
}

module.exports = withProguard;
