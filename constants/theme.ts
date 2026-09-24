import { Platform } from "react-native";

import { palette } from "./palette";

/**
 * Colours for plain React Native styles and navigation, from the app palette
 * (constants/palette.ts). Tamagui components use the matching theme tokens.
 */
export const Colors = {
  light: {
    text: palette.light.text,
    background: palette.light.background,
    surface: palette.light.surface,
    tint: palette.light.ink,
    icon: palette.light.muted,
    tabIconDefault: palette.light.muted,
    tabIconSelected: palette.light.ink,
    glass: {
      background: palette.light.glass,
      border: palette.light.glassBorder,
      text: palette.light.text,
      blurIntensity: 80,
    },
  },
  dark: {
    text: palette.dark.text,
    background: palette.dark.background,
    surface: palette.dark.surface,
    tint: palette.dark.ink,
    icon: palette.dark.muted,
    tabIconDefault: palette.dark.muted,
    tabIconSelected: palette.dark.ink,
    glass: {
      background: palette.dark.glass,
      border: palette.dark.glassBorder,
      text: palette.dark.text,
      blurIntensity: 80,
    },
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "Inter",
    rounded: "Inter",
    mono: "ui-monospace",
  },
  default: {
    sans: "Inter",
    rounded: "Inter",
    mono: "monospace",
  },
  web: {
    sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    rounded: "Inter, system-ui, sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
