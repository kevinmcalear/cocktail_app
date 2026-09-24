// Web uses Sentry's browser SDK: @sentry/react-native loads native modules at
// import time and breaks the static web export. @sentry/react is pinned to the
// @sentry/core version the native SDK resolves, so events match across
// platforms.
import * as Sentry from '@sentry/react';

import { appVariant } from '@/lib/appVariant';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

// Static rendering evaluates this module in Node; only report from browsers.
const enabled = !!dsn && typeof window !== 'undefined';

export function initMonitoring(): void {
  if (!enabled) return;
  Sentry.init({
    dsn,
    environment: appVariant,
    sendDefaultPii: false,
  });
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!enabled) {
    console.error(error, context);
    return;
  }
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function setMonitoringUser(userId: string | null): void {
  if (!enabled) return;
  Sentry.setUser(userId ? { id: userId } : null);
}
