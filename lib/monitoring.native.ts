import * as Sentry from '@sentry/react-native';

import { appVariant } from '@/lib/appVariant';
import { scrubBreadcrumb, scrubEvent } from '@/lib/monitoringScrub';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initMonitoring(): void {
  if (!dsn) return;
  // Release stays the store build (bundle id @ version + build). The SDK tags
  // each event with the EAS Update id, channel and runtime version by itself,
  // and debug IDs match OTA source maps whatever the release is called.
  Sentry.init({
    dsn,
    environment: appVariant,
    sendDefaultPii: false,
    // iOS records every request natively too, with query strings we can't scrub.
    enableNetworkBreadcrumbs: false,
    beforeBreadcrumb: scrubBreadcrumb,
    beforeSend: scrubEvent,
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
