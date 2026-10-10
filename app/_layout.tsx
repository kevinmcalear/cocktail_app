import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "expo-router/react-navigation";
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Toaster } from 'burnt/web';
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import { loadAsync, useFonts } from 'expo-font';
import { WebHead } from '@/components/WebHead';
import { BringInAnywhere } from '@/components/nav/BringInAnywhere';
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from "react";
import { palette } from "@/constants/palette";
import "react-native-reanimated";
import { TamaguiProvider, Theme } from 'tamagui';
import tamaguiConfig from '../tamagui.config';

import { DialogHost } from '@/components/DialogHost';
import { APP_FONTS, FIRST_PAINT_FONTS, LATER_FONTS } from '@/components/ds/fonts';
import { ObservabilityProvider } from '@/components/ObservabilityProvider';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ViewAsBanner } from '@/components/ViewAsBanner';
import { WebSideNav } from '@/components/nav/WebSideNav';
import { SearchPalette } from '@/components/search/SearchPalette';
import { AuthProvider, useAuth } from "@/ctx/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useUserCacheSync } from '@/hooks/useUserCacheSync';
import { BRAND } from '@/constants/brand';
import { authRedirect, needsOnboarding } from '@/lib/onboarding';
import { installWebAlert } from '@/lib/dialogs';
import { initMonitoring } from '@/lib/monitoring';
import { persistOptions, queryClient } from '@/lib/react-query';
import { Platform, View } from 'react-native';

export { ErrorScreen as ErrorBoundary } from '@/components/ErrorScreen';

initMonitoring();
installWebAlert();

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { session, user, loading, passwordRecovery } = useAuth();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  useUserCacheSync();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';
    // Privacy, terms, account-deletion and support pages must open without signing in,
    // and venue staff links (/v/<slug>) have their own branded sign-in. The
    // design gallery (/dev/gallery) shows no data. Published drinks (/d/<id>),
    // releases (/r/<id>), public profiles (/p/<handle>) and shared home menus
    // (/m/<id>) are public.
    if (segments[0] === 'legal' || segments[0] === 'support' || segments[0] === 'v' || segments[0] === 'dev' || segments[0] === 'd' || segments[0] === 'r' || segments[0] === 'p' || segments[0] === 'm' || segments[0] === 'e') return;
    // Signed out, a drink opens as its public card (/d/<id>), which asks you to sign in for the rest.
    const drink = !session && /^\/cocktail\/([^/]+)$/.exec(pathname);
    if (drink) return router.replace(`/d/${drink[1]}`);
    const authScreen = segments.at(1);
    // stay on recovery / email-link routes while session is established
    const stayInAuth =
      authScreen === 'reset-password' ||
      authScreen === 'callback' ||
      passwordRecovery;

    const to = authRedirect({
      hasSession: !!session,
      inAuthGroup,
      authScreen,
      stayInAuth,
      passwordRecovery,
      segment: segments[0],
      needsOnboarding: needsOnboarding(session?.user.user_metadata),
    });
    if (to) router.replace(to);
  }, [session, loading, segments, pathname, passwordRecovery]);

  // ponytail: persistent web chrome — sidebar outside the stack so it never unmounts.
  // Phone-width web gets the phone tab bar instead (see the tabs layout).
  const isWideWeb = useIsWideWeb();
  // `user`, not `session`: at launch it can be the saved session's user, whose
  // cached venues paint before auth-js finishes refreshing their token.
  const showWebSidebar = isWideWeb && !!user && segments[0] !== 'auth' && segments[0] !== 'v' && segments[0] !== 'onboarding';

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
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {showWebSidebar ? <WebSideNav /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="v/[slug]" options={{ headerShown: false }} />
            <Stack.Screen name="d/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="r/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="m/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="e/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="week" options={{ headerShown: false }} />
            <Stack.Screen
              name="add-cocktail"
              options={{ presentation: "modal", headerShown: false }}
            />
            <Stack.Screen
              name="add-ingredient"
              options={{ presentation: "modal", headerShown: false }}
            />
            <Stack.Screen
              name="add-beer"
              options={{ presentation: "modal", headerShown: false }}
            />
            <Stack.Screen
              name="add-wine"
              options={{ presentation: "modal", headerShown: false }}
            />
            <Stack.Screen
              name="cocktail/[id]/index"
              options={{ presentation: "modal", headerShown: false }}
            />
            <Stack.Screen
              name="cocktail/[id]/edit"
              options={{ presentation: "modal", headerShown: false }}
            />
            <Stack.Screen
              name="cocktail/[id]/batch"
              options={{ presentation: "modal", headerShown: false }}
            />
            <Stack.Screen
              name="beer/[id]/index"
              options={{ presentation: "modal", headerShown: false }}
            />
            <Stack.Screen
              name="beer/[id]/edit"
              options={{ presentation: "modal", headerShown: false }}
            />
            <Stack.Screen
              name="wine/[id]/index"
              options={{ presentation: "modal", headerShown: false }}
            />
            <Stack.Screen
              name="wine/[id]/edit"
              options={{ presentation: "modal", headerShown: false }}
            />
            <Stack.Screen
              name="ingredient/[id]/index"
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
            {/* Redesign routes. Declared here because on iOS, a screen pushed over a modal
                (the drink or ingredient page) ignores headerShown set from inside it. */}
            <Stack.Screen name="back-bar" options={{ headerShown: false }} />
            <Stack.Screen name="team" options={{ headerShown: false }} />
            <Stack.Screen name="bring-in" options={{ headerShown: false }} />
            <Stack.Screen name="drafts" options={{ headerShown: false }} />
            <Stack.Screen name="p/[id]/index" options={{ headerShown: false }} />
            <Stack.Screen name="p/[id]/menus/[edition]" options={{ headerShown: false }} />
            <Stack.Screen name="p/[id]/claim" options={{ headerShown: false }} />
            <Stack.Screen name="you" options={{ headerShown: false }} />
            <Stack.Screen name="taste" options={{ headerShown: false }} />
            <Stack.Screen name="support" options={{ headerShown: false, title: "Support" }} />
            <Stack.Screen name="settings/bar/[id]/index" options={{ headerShown: false }} />
            <Stack.Screen name="settings/bar/[id]/brand" options={{ headerShown: false }} />
            <Stack.Screen name="p/review-claims" options={{ headerShown: false }} />
            <Stack.Screen name="rankings/[itemId]" options={{ headerShown: false }} />
            <Stack.Screen name="settings/bar/[id]/publishing" options={{ headerShown: false }} />
            <Stack.Screen name="settings/bar/[id]/dilution" options={{ headerShown: false }} />
            <Stack.Screen name="settings/bar/[id]/pricing" options={{ headerShown: false }} />
            <Stack.Screen name="study/[deck]" options={{ headerShown: false }} />
            <Stack.Screen name="menus/all" options={{ headerShown: false }} />
            <Stack.Screen name="menus/from-photo" options={{ headerShown: false }} />
            <Stack.Screen name="menus/[id]/index" options={{ headerShown: false }} />
            <Stack.Screen name="menus/[id]/card" options={{ headerShown: false }} />
            <Stack.Screen name="menus/[id]/costing" options={{ headerShown: false }} />
            <Stack.Screen name="settings/bar/[id]/releases/[releaseId]" options={{ headerShown: false }} />
            <Stack.Screen name="menus/[id]/edit" options={{ headerShown: false, gestureEnabled: false }} />
          </Stack>
        </View>
        {showWebSidebar ? <SearchPalette /> : null}
        {Platform.OS === 'web' && session ? <BringInAnywhere /> : null}
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
    const background = palette[scheme].background;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      m.setAttribute('content', background);
    });
    document.documentElement.style.colorScheme = scheme;
    document.body.style.backgroundColor = background;
  }, [scheme]);
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  useWebThemeChrome(colorScheme);
  // Native waits once for every face, so text never flashes in a fallback.
  // Web renders straight away, so the static export produces real HTML: the
  // export preloads the first-paint faces and the rest load after.
  const [fontsLoaded] = useFonts(Platform.OS === 'web' ? FIRST_PAINT_FONTS : APP_FONTS);
  useEffect(() => {
    if (Platform.OS === 'web') loadAsync(LATER_FONTS).catch((e) => console.warn('Fonts failed to load', e));
  }, []);
  if (!fontsLoaded && Platform.OS !== 'web') { return null; }
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={colorScheme === "dark" ? "dark" : "light"}>
      <Theme name={colorScheme === "dark" ? "dark" : "light"}>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            <BottomSheetModalProvider>
              <AuthProvider>
                <ObservabilityProvider>
                  <OfflineBanner />
                  <ViewAsBanner />
                  <RootLayoutNav />
                </ObservabilityProvider>
              </AuthProvider>
              <DialogHost />
              {Platform.OS === 'web' ? <Toaster /> : null}
            </BottomSheetModalProvider>
          </GestureHandlerRootView>
        </PersistQueryClientProvider>
      </Theme>
    </TamaguiProvider>
  );
}
