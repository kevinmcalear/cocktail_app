import { useSegments } from 'expo-router';
import { PostHogProvider, usePostHog, type PostHogCustomAppProperties } from 'posthog-react-native';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/ctx/AuthContext';
import { setAnalyticsClient } from '@/lib/analytics';
import { noteSignIn } from '@/lib/analyticsDoor';
import { appUpdate } from '@/lib/appUpdate';
import { appVariant } from '@/lib/appVariant';

/**
 * Identifies the signed-in user in PostHog by id, and forgets them on sign-out.
 * Only then: a reset on every signed-out launch gave each visit a new anonymous
 * id, so a visitor's table open and their sign-up never joined up.
 */
function AnalyticsIdentity() {
  const posthog = usePostHog();
  // Once auth settles: until then `user` can be the saved session's, not yet confirmed.
  const { session, loading } = useAuth();
  const userId = loading ? undefined : (session?.user.id ?? null);
  const before = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (userId === undefined) return;
    const wasSignedOut = before.current === null;
    before.current = userId;
    if (userId) {
      posthog.identify(userId);
      // Signing in here and now, not a launch with a saved session.
      if (wasSignedOut) noteSignIn();
      return;
    }
    let current = true;
    void posthog.ready().then(() => {
      if (current && posthog.getDistinctId() !== posthog.getAnonymousId()) posthog.reset();
    });
    return () => {
      current = false;
    };
  }, [posthog, userId]);
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

const HIDDEN = { position: 'absolute', width: 0, height: 0 } as const;

/**
 * On every event, set once when the client is made. Not register(): reset()
 * clears those, and the app's first events go out before an effect can run,
 * which left 13% of screen views with no platform or build.
 *
 * No GeoIP: PostHog would otherwise add the city each event came from, which
 * the privacy policy and store labels don't declare.
 */
const appProperties = (props: PostHogCustomAppProperties) =>
  Object.assign({}, props, {
    $geoip_disable: true,
    app_surface: Platform.OS,
    app_variant: appVariant,
    // Which over-the-air update this is, as $app_build can't tell.
    app_update: appUpdate(),
  });

/**
 * Application Opened carries the link the app opened with. Keep its path:
 * a sign-in link's query holds its one-time token, and others can hold what
 * someone typed.
 */
const pathOnly = <E extends { properties?: Record<string, unknown> } | null>(event: E): E => {
  const url = event?.properties?.url;
  if (event?.properties && typeof url === 'string') event.properties.url = url.split(/[?#]/)[0];
  return event;
};

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
      options={{ host, customAppProperties: appProperties, before_send: pathOnly }}
      autocapture={{ captureScreens: false, captureTouches: false }}
    >
      <AnalyticsIdentity />
      <EventSink />
      <ScreenTracker />
    </PostHogProvider>
  );
}
