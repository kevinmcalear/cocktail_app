/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

// Modern IOS Dark Palette
const pureBlack = "#000000"; // Pure black background
const systemGray6 = "#1C1C1E"; // Secondary background
const systemBlue = "#0A84FF"; // iOS System Blue (Dark Mode)
const white = "#FFFFFF";
const glassBorder = "rgba(255, 255, 255, 0.1)";

export const Colors = {
  light: {
    // Keeping light mode somewhat consistent but mapped to new logic if needed later
    // prioritizing dark mode as requested.
    text: pureBlack,
    background: "#F2F2F7", // System Gray 6 Light
    tint: "#007AFF", // System Blue Light
    icon: "#8E8E93",
    tabIconDefault: "#8E8E93",
    tabIconSelected: "#007AFF",
  },
  dark: {
    text: white,
    background: pureBlack,
    surface: systemGray6,
    tint: white, // Changed from systemBlue to white as requested
    icon: "#98989D", // System Gray
    tabIconDefault: "#98989D",
    tabIconSelected: white, // Changed from systemBlue to white
    glass: {
      background: "rgba(28, 28, 30, 0.6)", // Transparent system gray
      border: glassBorder,
      text: white,
      blurIntensity: 80,
    }
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "Roboto",
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
