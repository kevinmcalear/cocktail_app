import * as Sentry from '@sentry/react-native';

import { appVariant } from '@/lib/appVariant';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initMonitoring(): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: appVariant,
    sendDefaultPii: false,
  });
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!dsn) {
    console.error(error, context);
    return;
  }
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function setMonitoringUser(userId: string | null): void {
  if (!dsn) return;
  Sentry.setUser(userId ? { id: userId } : null);
}
