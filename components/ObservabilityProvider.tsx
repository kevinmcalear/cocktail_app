import { lazy, type ReactNode, Suspense, useEffect, useSyncExternalStore } from 'react';

import { useAuth } from '@/ctx/AuthContext';
import { analyticsAvailable, analyticsOptedOut, subscribeAnalytics } from '@/lib/analytics';
import { loadAnalyticsChoice } from '@/lib/analyticsChoice';
import { setMonitoringUser } from '@/lib/monitoring';

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

// A separate chunk on web, fetched only when analytics is configured.
const Analytics = lazy(() => import('@/components/Analytics'));

/** Tags Sentry errors with the signed-in user's id. */
function MonitoringIdentity() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  useEffect(() => {
    setMonitoringUser(userId);
  }, [userId]);
  return null;
}

/**
 * Error monitoring identity plus PostHog product analytics. PostHog runs only
 * when EXPO_PUBLIC_POSTHOG_KEY is set, never during static web rendering, and
 * not at all once someone turns analytics off in Settings: it isn't mounted,
 * so even its own app-open and screen events stop.
 */
export function ObservabilityProvider({ children }: { children: ReactNode }) {
  const optedOut = useSyncExternalStore(subscribeAnalytics, analyticsOptedOut, analyticsOptedOut);
  useEffect(() => {
    if (analyticsAvailable()) void loadAnalyticsChoice();
  }, []);
  return (
    <>
      <MonitoringIdentity />
      {POSTHOG_KEY && optedOut === false ? (
        <Suspense fallback={null}>
          <Analytics apiKey={POSTHOG_KEY} host={POSTHOG_HOST} />
        </Suspense>
      ) : null}
      {children}
    </>
  );
}
