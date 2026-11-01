import type { ThemeAndroidProps } from './ThemeAndroid.android';

/**
 * Theme on Android is ThemeAndroid.android.tsx (canvas Theme-and). iOS and
 * the web draw the phone and desktop layouts instead, so they never load it
 * (or the carousel's Reanimated).
 */
export function ThemeAndroid(_props: ThemeAndroidProps) {
  return null;
}
