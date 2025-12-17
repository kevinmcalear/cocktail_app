/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

// Caretaker's Cottage Inspired Palette
const bluestone = "#1A2228"; // Deep, cool charcoal/blue background
const paisleyGreen = "#1E362D"; // Deep forest/paisley green
const tasmanianOak = "#C19A6B"; // Warm golden wood tone
const warmLight = "#FDF6E3"; // Soft creamy light
const glassBorder = "rgba(255, 255, 255, 0.1)";

export const Colors = {
  light: {
    text: bluestone,
    background: warmLight,
    tint: tasmanianOak,
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: tasmanianOak,
  },
  dark: {
    text: "#ECEDEE",
    background: bluestone, // Main background
    surface: paisleyGreen, // Secondary background for cards etc (if opaque)
    tint: tasmanianOak,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tasmanianOak,
    glass: {
      background: "rgba(26, 34, 40, 0.7)", // Bluestone with transparency
      border: glassBorder,
      text: "#ECEDEE",
      blurIntensity: 80,
    }
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
