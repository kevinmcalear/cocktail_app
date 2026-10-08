import { useSegments } from 'expo-router';
import { PostHogProvider, usePostHog, type PostHogCustomAppProperties } from 'posthog-react-native';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/ctx/AuthContext';
import { setAnalyticsClient } from '@/lib/analytics';
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

/** Hands the client to lib/analytics, which sends the launch events. */
function EventSink() {
  const posthog = usePostHog();
  useEffect(() => {
    setAnalyticsClient(posthog);
    return () => setAnalyticsClient(null);
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

// No GeoIP: PostHog would otherwise add the city each event came from, which
// the privacy policy and store labels don't declare.
const HIDDEN = { position: 'absolute', width: 0, height: 0 } as const;

const withoutGeoip = (props: PostHogCustomAppProperties) => Object.assign({}, props, { $geoip_disable: true });

/**
 * PostHog product analytics. Loaded as its own chunk by ObservabilityProvider,
 * and only when EXPO_PUBLIC_POSTHOG_KEY is set, so builds without analytics
 * don't ship the SDK. Nothing else in the app talks to PostHog directly:
 * product events go through track() in lib/analytics.
 */
export default function Analytics({ apiKey, host }: { apiKey: string; host: string }) {
  return (
    // PostHogProvider wraps its children in a View that defaults to flex: 1, and
    // it sits beside the app (ObservabilityProvider), so it would take half the
    // screen. Its children render nothing, so a zero-size view is enough.
    <PostHogProvider
      style={HIDDEN}
      apiKey={apiKey}
      options={{ host, customAppProperties: withoutGeoip }}
      autocapture={{ captureScreens: false, captureTouches: false }}
    >
      <SuperProperties />
      <AnalyticsIdentity />
      <EventSink />
      <ScreenTracker />
    </PostHogProvider>
  );
}
