import { Platform } from 'react-native';

/** True on iOS/macOS (native, or a browser on an Apple device): show ⌘ rather than Ctrl. */
export function isApplePlatform(): boolean {
  if (Platform.OS === 'ios') return true;
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const platform = (navigator as any).userAgentData?.platform ?? navigator.platform ?? '';
  return /mac|iphone|ipad|ipod/i.test(platform) || /Mac OS X/.test(navigator.userAgent);
}
