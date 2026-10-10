import { AppState, Platform } from 'react-native';

import { optionalNative } from '@/lib/optionalNative';

type NotificationsModule = typeof import('expo-notifications');
// Native only, and only in builds that have the module (older builds get this code by update).
// eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only where the native module exists
const notifications = Platform.OS === 'web' ? null : optionalNative<NotificationsModule>('ExpoNotificationScheduler', () => require('expo-notifications'));

let allowed = false;

/** Whether a finished reading can tap you (a local notification), so the tray can promise it. */
export function canNudge(): boolean {
  return !!notifications && allowed;
}

/**
 * Asks once for notifications, when someone leaves a reading to carry on
 * ("Keep using the app, we'll tell you"). Resolves whether it may nudge.
 */
export async function askToNudge(): Promise<boolean> {
  if (!notifications) return false;
  try {
    const now = await notifications.getPermissionsAsync();
    allowed = now.granted || (now.canAskAgain && (await notifications.requestPermissionsAsync()).granted);
  } catch {
    allowed = false;
  }
  return allowed;
}

/**
 * "We'll tap you when it's ready": a local notification when a reading
 * finishes while the app is in the background. In the app, the tray says it.
 */
export function nudgeWhenReady(what: string): void {
  if (!notifications || !allowed || AppState.currentState === 'active') return;
  void notifications
    .scheduleNotificationAsync({
      content: { title: 'Ready to check', body: `${what.charAt(0).toUpperCase()}${what.slice(1)} is read. Check it before it saves.`, data: { url: '/bring-in' } },
      trigger: null,
    })
    .catch(() => {});
}

/** Tapping the nudge opens the check. Returns the unsubscribe. */
export function onNudgeTapped(open: () => void): () => void {
  if (!notifications) return () => {};
  const sub = notifications.addNotificationResponseReceivedListener((response) => {
    if (response.notification.request.content.data?.url === '/bring-in') open();
  });
  return () => sub.remove();
}
