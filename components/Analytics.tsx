import { useSegments } from 'expo-router';
import { PostHogProvider, usePostHog } from 'posthog-react-native';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/ctx/AuthContext';
import { appVariant } from '@/lib/appVariant';

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

/** Tags every event with the platform and build, so test builds filter out. */
function SuperProperties() {
  const posthog = usePostHog();
  useEffect(() => {
    posthog.register({ app_surface: Platform.OS, app_variant: appVariant });
  }, [posthog]);
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
 * PostHog product analytics. Loaded as its own chunk by ObservabilityProvider,
 * and only when EXPO_PUBLIC_POSTHOG_KEY is set, so builds without analytics
 * don't ship the SDK. Nothing else in the app talks to PostHog directly.
 */
export default function Analytics({ apiKey, host }: { apiKey: string; host: string }) {
  return (
    <PostHogProvider
      apiKey={apiKey}
      options={{ host }}
      autocapture={{ captureScreens: false, captureTouches: false }}
    >
      <SuperProperties />
      <AnalyticsIdentity />
      <ScreenTracker />
    </PostHogProvider>
  );
}
