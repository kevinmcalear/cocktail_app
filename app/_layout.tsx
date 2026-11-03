import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "expo-router/react-navigation";
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import { loadAsync, useFonts } from 'expo-font';
import { Observe, ObserveRoot, useObserve } from 'expo-observe';
import { WebHead } from '@/components/WebHead';
import { WebToaster } from '@/components/WebToaster';
import { StatusBar } from "expo-status-bar";
import { GestureRoot } from '@/components/ds/GestureRoot';
import { useEffect } from "react";
import { backbar } from "@/constants/tokens";
import '@/lib/reanimatedSetup';
import { useReducedMotion } from '@/hooks/useReducedMotion';

import { DialogHost, ViewAsBanner } from '@/components/nav/RootHosts';
import { ToastHost } from '@/components/ds/Toast';
import { APP_FONTS, FIRST_PAINT_FONTS, LATER_FONTS } from '@/components/ds/fonts';
import { ObservabilityProvider } from '@/components/ObservabilityProvider';
import { OfflineBanner } from '@/components/OfflineBanner';
import { AuthProvider, useAuth } from "@/ctx/AuthContext";
import { BarUnitSync } from '@/hooks/useBarUnitSync';
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useHoldUpdates, useOtaUpdates } from '@/hooks/useOtaUpdates';
import { useSpecBooks } from '@/hooks/useSpecBook';
import { useUserCacheSync } from '@/hooks/useUserCacheSync';
import { BRAND } from '@/constants/brand';
import { authRedirect, needsOnboarding } from '@/lib/onboarding';
import { installWebAlert } from '@/lib/dialogs';
import { afterFirstData } from '@/lib/idleQueue';
import { prefetchRoutes } from '@/lib/prefetchRoutes';
import { BringIn, RootExtras, SideNav } from '@/components/nav/RootLazy';

import { initMonitoring } from '@/lib/monitoring';
import { persistOptions, queryClient, resumeSavedWrites } from '@/lib/react-query';
import { Platform, View } from 'react-native';


export { ErrorScreen as ErrorBoundary } from '@/components/ErrorScreen';

initMonitoring();
// EAS Observe: launch, first render and time to interactive, per route too.
// Module scope: the router integration can't be switched on once a screen
// has mounted. Debug builds don't send (Observe's default).
Observe.configure({ integrations: { 'expo-router': true } });
installWebAlert();

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const reduceMotion = useReducedMotion();
  const { session, user, loading } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  useUserCacheSync();
  // The spec book of every venue they work at, on this phone (hooks/useSpecBook.ts).
  useSpecBooks();
  useOtaUpdates();
  // Signing in sends people to their mail for the code: a reload would lose the step.
  useHoldUpdates(segments[0] === 'auth' || segments[0] === 'onboarding');
  // Interactive once auth has settled and the first screen can respond.
  const { markInteractive } = useObserve();
  useEffect(() => {
    if (!loading) markInteractive();
  }, [loading, markInteractive]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';
    // Privacy, terms, account-deletion and support pages must open without signing in,
    // and venue staff links (/v/<slug>) have their own branded sign-in. The
    // design gallery (/dev/gallery) shows no data. Published drinks (/d/<id>),
    // releases (/r/<id>), public profiles (/p/<handle>), shared home menus
    // (/m/<id>) and public events (/e/<id>) are public.
    if (segments[0] === 'legal' || segments[0] === 'support' || segments[0] === 'v' || segments[0] === 'dev' || segments[0] === 'd' || segments[0] === 'r' || segments[0] === 'p' || segments[0] === 'm' || segments[0] === 'e') return;
    // Your allergies are kept on this phone until you sign in (Loop-allergy, At a table, signed out).
    if (segments[0] === 'settings' && (segments as string[])[1] === 'allergies') return;
    // Signed out, a drink opens as its public card (/d/<id>), which asks you to sign in for the rest.
    const drink = !session && /^\/cocktail\/([^/]+)$/.exec(pathname);
    if (drink) return router.replace(`/d/${drink[1]}`);
    const authScreen = segments.at(1);
    // stay on the email-link route while the session is established
    const stayInAuth = authScreen === 'callback';

    const to = authRedirect({
      hasSession: !!session,
      inAuthGroup,
      authScreen,
      stayInAuth,
      segment: segments[0],
      needsOnboarding: needsOnboarding(session?.user.user_metadata),
    });
    if (to) router.replace(to);
  }, [session, loading, segments, pathname]);

  // ponytail: persistent web chrome — sidebar outside the stack so it never unmounts.
  // Phone-width web gets the phone tab bar instead (see the tabs layout).
  const isWideWeb = useIsWideWeb();
  // `user`, not `session`: at launch it can be the saved session's user, whose
  // cached venues paint before auth-js finishes refreshing their token.
  // The menu builder fills the whole width (its library, the menu and the guest card), as
  // drawn, and the printable guest card and run sheet are bare pages.
  const building = segments[0] === 'menus' && (['edit', 'card'].includes((segments as string[])[2]) || (segments as string[])[3] === 'print');
  const showWebSidebar = isWideWeb && !!user && segments[0] !== 'auth' && segments[0] !== 'v' && segments[0] !== 'onboarding' && segments[0] !== 'venue-setup' && segments[0] !== 'snap' && !building;

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <WebHead>
        <title>{BRAND.productName}</title>
      </WebHead>
      {Platform.OS === 'web' && (
        <style dangerouslySetInnerHTML={{__html: `
          html, body, #root {
            font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            height: 100%;
          }
          #root { display: flex; flex-direction: column; }
          a, button, [role="button"], [role="link"] {
            cursor: pointer !important;
          }
        `}} />
      )}
      <BarUnitSync />
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {showWebSidebar ? <SideNav /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="v/[slug]" options={{ headerShown: false }} />
            <Stack.Screen name="d/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="r/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="m/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="e/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="week/index" options={{ headerShown: false }} />
            <Stack.Screen name="week/review" options={{ headerShown: false }} />
            <Stack.Screen name="add-cocktail" options={{ presentation: "modal", headerShown: false }} />
            <Stack.Screen name="add-ingredient" options={{ presentation: "modal", headerShown: false }} />
            <Stack.Screen name="make-recipe" options={{ presentation: "modal", headerShown: false }} />
            <Stack.Screen name="add-beer" options={{ presentation: "modal", headerShown: false }} />
            <Stack.Screen name="add-wine" options={{ presentation: "modal", headerShown: false }} />
            <Stack.Screen
              name="cocktail/[id]/edit"
              options={{ presentation: "modal", headerShown: false }}
            />
            <Stack.Screen
              name="cocktail/[id]/batch"
              options={{ presentation: "modal", headerShown: false }}
            />
            <Stack.Screen
              name="cocktail/[id]/roles"
              options={{ presentation: "modal", headerShown: false }}
            />
            <Stack.Screen
              name="beer/[id]/edit"
              options={{ presentation: "modal", headerShown: false }}
            />
            <Stack.Screen
              name="wine/[id]/edit"
              options={{ presentation: "modal", headerShown: false }}
            />
            <Stack.Screen
              name="ingredient/[id]/edit"
              options={{ presentation: "modal", headerShown: false }}
            />
            {/* Make mode: a whole screen over the page, no swipe away mid-batch. */}
            <Stack.Screen
              name="ingredient/[id]/make"
              options={{ presentation: "fullScreenModal", headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen name="share/poster" options={{ presentation: "modal", headerShown: false }} />
            <Stack.Screen name="print/index" options={{ presentation: "modal", headerShown: false }} />
            <Stack.Screen name="print/sheet" options={{ headerShown: false }} />
            <Stack.Screen name="label/index" options={{ presentation: "modal", headerShown: false }} />
            {/* Declared here because on iOS, a screen pushed over a modal ignores headerShown set from inside it. */}
            <Stack.Screen name="back-bar" options={{ headerShown: false }} />
            <Stack.Screen name="team/index" options={{ headerShown: false }} />
            <Stack.Screen name="team/[userId]" options={{ headerShown: false }} />
            {/* Add's viewfinder: the whole screen, no swipe away mid-shot; a fade under Reduce Motion. */}
            <Stack.Screen name="snap" options={{ presentation: "fullScreenModal", headerShown: false, gestureEnabled: false, animation: reduceMotion ? "fade" : "slide_from_bottom" }} />
            <Stack.Screen name="bring-in/index" options={{ headerShown: false }} />
            <Stack.Screen name="bring-in/done" options={{ headerShown: false }} />
            <Stack.Screen name="drafts" options={{ headerShown: false }} />
            <Stack.Screen name="p/[id]/index" options={{ headerShown: false }} />
            <Stack.Screen name="p/[id]/menus/[edition]" options={{ headerShown: false }} />
            <Stack.Screen name="p/[id]/claim" options={{ headerShown: false }} />
            <Stack.Screen name="p/[id]/bottles" options={{ headerShown: false }} />
            <Stack.Screen name="credits-to-check" options={{ headerShown: false }} />
            <Stack.Screen name="people/index" options={{ headerShown: false }} />
            <Stack.Screen name="people/find" options={{ headerShown: false }} />
            <Stack.Screen name="taste" options={{ headerShown: false }} />
            <Stack.Screen name="support" options={{ headerShown: false, title: "Support" }} />
            <Stack.Screen name="history" options={{ headerShown: false, title: "Cocktail history" }} />
            <Stack.Screen name="settings/index" options={{ headerShown: false, title: "Settings" }} />
            <Stack.Screen name="settings/bar/[id]/index" options={{ headerShown: false }} />
            <Stack.Screen name="settings/bar/[id]/brand" options={{ headerShown: false }} />
            <Stack.Screen name="settings/bar/[id]/roles/index" options={{ headerShown: false }} />
            <Stack.Screen name="settings/bar/[id]/roles/[role]" options={{ headerShown: false }} />
            <Stack.Screen name="p/review-claims" options={{ headerShown: false }} />
            <Stack.Screen name="p/review-photos" options={{ headerShown: false }} />
            <Stack.Screen name="rankings/[itemId]" options={{ headerShown: false }} />
            <Stack.Screen name="settings/bar/[id]/publishing" options={{ headerShown: false }} />
            <Stack.Screen name="settings/bar/[id]/dilution" options={{ headerShown: false }} />
            <Stack.Screen name="settings/bar/[id]/pricing" options={{ headerShown: false }} />
            <Stack.Screen name="settings/bar/[id]/calendars" options={{ headerShown: false }} />
            <Stack.Screen name="study/[deck]" options={{ headerShown: false }} />
            <Stack.Screen name="menus/all" options={{ headerShown: false }} />
            <Stack.Screen name="menus/[id]/index" options={{ headerShown: false }} />
            <Stack.Screen name="menus/[id]/card" options={{ headerShown: false }} />
            <Stack.Screen name="menus/[id]/costing" options={{ headerShown: false }} />
            <Stack.Screen name="menus/[id]/run-sheet/index" options={{ headerShown: false }} />
            <Stack.Screen name="menus/[id]/run-sheet/print" options={{ headerShown: false }} />
            <Stack.Screen name="settings/bar/[id]/releases/[releaseId]" options={{ headerShown: false }} />
            <Stack.Screen name="settings/bar/[id]/kit/[kind]/[item]" options={{ headerShown: false }} />
            <Stack.Screen name="menus/[id]/edit" options={{ headerShown: false, gestureEnabled: false }} />
          </Stack>
          {/* Over the page, beside the sidebar: Bring in's sheet, drop dialog and reading tray. */}
          {session ? <BringIn /> : null}
        </View>
        <RootExtras palette={showWebSidebar} signedIn={!!session} />
      </View>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}


/**
 * On web, make the browser chrome follow the in-app Light/Dark choice, not just
 * the OS: theme-color (address bar / installed-app title bar), color-scheme
 * (scrollbars, form controls) and the page background behind the app.
 */
function useWebThemeChrome(scheme: 'light' | 'dark') {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const background = backbar[scheme].ground;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      m.setAttribute('content', background);
    });
    document.documentElement.style.colorScheme = scheme;
    document.body.style.backgroundColor = background;
  }, [scheme]);
}

function RootLayout() {
  const colorScheme = useColorScheme();
  useWebThemeChrome(colorScheme);
  // Native waits once for every face, so text never flashes in a fallback.
  // Web renders straight away, so the static export produces real HTML: the
  // export preloads the first-paint faces and the rest load after.
  const [fontsLoaded] = useFonts(Platform.OS === 'web' ? FIRST_PAINT_FONTS : APP_FONTS);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    // Redaction's italic and bold, and the main screens' code: once the first
    // screen's data is in and the network has been quiet for a second, so a
    // slow connection fetches that first (RAIL load). Starting at 4 s whatever
    // the data was doing put a megabyte of code beside Discover's requests.
    // Text uses a fallback till then. A screen with nothing to fetch starts them at 4 s.
    return afterFirstData(
      queryClient,
      () => {
        loadAsync(LATER_FONTS).catch((e) => console.warn('Fonts failed to load', e));
        void prefetchRoutes();
      },
      15_000,
      1_000,
      4_000
    );
  }, []);
  if (!fontsLoaded && Platform.OS !== 'web') { return null; }
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions} onSuccess={resumeSavedWrites}>
      <GestureRoot style={{ flex: 1 }}>
        <AuthProvider>
          <ObservabilityProvider>
            <OfflineBanner />
            <ViewAsBanner />
            <RootLayoutNav />
          </ObservabilityProvider>
        </AuthProvider>
        <DialogHost />
        <ToastHost />
        <WebToaster />
      </GestureRoot>
    </PersistQueryClientProvider>
  );
}

export default ObserveRoot.wrap(RootLayout);
