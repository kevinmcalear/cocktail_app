// Web uses Sentry's browser SDK: @sentry/react-native loads native modules at
// import time and breaks the static web export. @sentry/react is pinned to the
// @sentry/core version the native SDK resolves, so events match across
// platforms.
//
// The SDK is about a tenth of the web bundle, so it's loaded as a separate
// chunk, and only when a DSN is configured.
import { appVariant } from '@/lib/appVariant';
import { scrubBreadcrumb, scrubEvent } from '@/lib/monitoringScrub';

type SentryModule = typeof import('@sentry/react');

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

// Static rendering evaluates this module in Node; only report from browsers.
const enabled = !!dsn && typeof window !== 'undefined';

let sentry: SentryModule | null = null;
// Errors and the user from before the SDK finishes loading, replayed once it has.
const pendingErrors: { error: unknown; context?: Record<string, unknown> }[] = [];
let pendingUserId: string | null | undefined;

/** Runs once the browser is idle (or after a few seconds at most). */
function whenIdle(run: () => void): void {
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 1500); // Safari has no requestIdleCallback
}

export function initMonitoring(): void {
  if (!enabled) return;
  // The SDK chunk is about 1.3 MB: fetch it after the first paint, not
  // alongside it. Errors and the user from before then are queued below.
  whenIdle(() => void loadSentry());
}

function loadSentry() {
  return import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn,
        environment: appVariant,
        sendDefaultPii: false,
        beforeBreadcrumb: scrubBreadcrumb,
        beforeSend: scrubEvent,
      });
      sentry = Sentry;
      if (pendingUserId !== undefined) Sentry.setUser(pendingUserId ? { id: pendingUserId } : null);
      for (const { error, context } of pendingErrors.splice(0)) {
        Sentry.captureException(error, context ? { extra: context } : undefined);
      }
    })
    .catch((e) => console.warn('Error monitoring failed to load', e));
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!enabled) {
    console.error(error, context);
    return;
  }
  if (!sentry) {
    pendingErrors.push({ error, context });
    return;
  }
  sentry.captureException(error, context ? { extra: context } : undefined);
}

export function setMonitoringUser(userId: string | null): void {
  if (!enabled) return;
  if (!sentry) {
    pendingUserId = userId;
    return;
  }
  sentry.setUser(userId ? { id: userId } : null);
}
