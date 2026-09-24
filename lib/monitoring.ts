// Fallback used by type checking and Node scripts. The app loads
// monitoring.native.ts (Sentry React Native) or monitoring.web.ts (Sentry
// browser SDK) instead; keep the three exports in sync.

/** Starts error monitoring when EXPO_PUBLIC_SENTRY_DSN is set. */
export function initMonitoring(): void {}

/** Reports an unexpected error (or logs it when monitoring is off). */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  console.error(error, context);
}

/** Attaches the signed-in user's id (never email) to reported errors. */
export function setMonitoringUser(_userId: string | null): void {}
