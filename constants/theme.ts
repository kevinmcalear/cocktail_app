/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from "react-native";

// Orange and earth tone inspired colors
const tintColorLight = "#E67E22"; // Vibrant orange
const tintColorDark = "#F39C12"; // Golden orange

export const Colors = {
  light: {
    text: "#2C3E50", // Dark blue-gray
    background: "#FDF2E9", // Warm orange-tinted cream
    tint: tintColorLight,
    icon: "#D35400", // Dark orange
    tabIconDefault: "#E67E22", // Vibrant orange
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#FDF2E9", // Warm cream
    background: "#1A1A1A", // Dark charcoal
    tint: tintColorDark,
    icon: "#F39C12", // Golden orange
    tabIconDefault: "#F39C12", // Golden orange
    tabIconSelected: tintColorDark,
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
