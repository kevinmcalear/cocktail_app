/**
 * "We'll tap you when it's ready": a nudge when a reading finishes while
 * you're elsewhere in the app. The tray says so on every platform; a local
 * notification needs expo-notifications, which this build doesn't have yet.
 *
 * ponytail: a no-op until the notifications module ships in a store build.
 */
export function nudgeWhenReady(_what: string): void {}

/** Whether a finished reading can nudge you (a local notification), so the tray can promise it. */
export function canNudge(): boolean {
  return false;
}
