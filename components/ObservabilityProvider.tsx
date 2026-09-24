import { useSegments } from 'expo-router';
import { PostHogProvider, usePostHog } from 'posthog-react-native';
import { type ReactNode, useEffect } from 'react';

import { useAuth } from '@/ctx/AuthContext';
import { setMonitoringUser } from '@/lib/monitoring';

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

/** Tags Sentry errors with the signed-in user's id. */
function MonitoringIdentity() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  useEffect(() => {
    setMonitoringUser(userId);
  }, [userId]);
  return null;
}

/** Identifies the signed-in user in PostHog by id, and forgets them on sign-out. */
function AnalyticsIdentity() {
  const posthog = usePostHog();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  useEffect(() => {
    if (userId) posthog.identify(userId);
    else posthog.reset();
  }, [posthog, userId]);
  return null;
}

/** Records a screen view per route pattern (e.g. /cocktail/[id]), not per URL. */
function ScreenTracker() {
  const posthog = usePostHog();
  const segments = useSegments();
  const screen = `/${segments.join('/')}`;
  useEffect(() => {
    posthog.screen(screen);
  }, [posthog, screen]);
  return null;
}

/**
 * Error monitoring identity plus PostHog product analytics. PostHog runs only
 * when EXPO_PUBLIC_POSTHOG_KEY is set, and never during static web rendering.
 */
export function ObservabilityProvider({ children }: { children: ReactNode }) {
  if (!POSTHOG_KEY || typeof window === 'undefined') {
    return (
      <>
        <MonitoringIdentity />
        {children}
      </>
    );
  }

  return (
    <PostHogProvider
      apiKey={POSTHOG_KEY}
      options={{ host: POSTHOG_HOST }}
      autocapture={{ captureScreens: false, captureTouches: false }}
    >
      <MonitoringIdentity />
      <AnalyticsIdentity />
      <ScreenTracker />
      {children}
    </PostHogProvider>
  );
}
