import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

// One reading for the whole app: Increase Contrast on iOS, high contrast text on Android.
let on = false;
const listeners = new Set<() => void>();
const set = (next: boolean) => {
  if (next === on) return;
  on = next;
  listeners.forEach((l) => l());
};
const event = Platform.OS === 'ios' ? 'darkerSystemColorsChanged' : 'highTextContrastChanged';
const read = () => (Platform.OS === 'ios' ? AccessibilityInfo.isDarkerSystemColorsEnabled() : AccessibilityInfo.isHighTextContrastEnabled());
let watching: { remove: () => void } | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!watching) {
    watching = AccessibilityInfo.addEventListener(event, set);
    read().then(set, () => {});
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      watching?.remove();
      watching = null;
    }
  };
}

/**
 * Whether the person has asked the system for more contrast. It overrides a
 * bar's theme (canvas th-n-guard): buttons go ink on cream (useDs).
 */
export function useMoreContrast(): boolean {
  return useSyncExternalStore(subscribe, () => on, () => false);
}
