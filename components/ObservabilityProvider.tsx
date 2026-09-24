import { lazy, type ReactNode, Suspense, useEffect } from 'react';

import { useAuth } from '@/ctx/AuthContext';
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
 * when EXPO_PUBLIC_POSTHOG_KEY is set, and never during static web rendering.
 */
export function ObservabilityProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <MonitoringIdentity />
      {POSTHOG_KEY && typeof window !== 'undefined' ? (
        <Suspense fallback={null}>
          <Analytics apiKey={POSTHOG_KEY} host={POSTHOG_HOST} />
        </Suspense>
      ) : null}
      {children}
    </>
  );
}
