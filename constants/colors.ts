const palette = {
  navy: "#0A1628",
  navyLight: "#132240",
  navyMid: "#1B2D4A",
  teal: "#00D4AA",
  tealDark: "#00B894",
  tealMuted: "rgba(0, 212, 170, 0.15)",
  white: "#FFFFFF",
  textPrimary: "#E8ECF4",
  textSecondary: "#8B95A8",
  textMuted: "#5A6478",
  red: "#FF5A5F",
  redMuted: "rgba(255, 90, 95, 0.15)",
  green: "#00D68F",
  greenMuted: "rgba(0, 214, 143, 0.15)",
  yellow: "#FFD93D",
  yellowMuted: "rgba(255, 217, 61, 0.15)",
  border: "rgba(255, 255, 255, 0.08)",
  cardBg: "rgba(19, 34, 64, 0.6)",
};

export default {
  light: {
    ...palette,
    text: palette.textPrimary,
    background: palette.navy,
    tint: palette.teal,
    tabIconDefault: palette.textMuted,
    tabIconSelected: palette.teal,
  },
};
