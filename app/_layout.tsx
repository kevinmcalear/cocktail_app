import { IBMPlexSans_600SemiBold_Italic, useFonts } from '@expo-google-fonts/ibm-plex-sans';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "expo-router/react-navigation";
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Toaster } from 'burnt/web';
import { Stack, useRouter, useSegments } from "expo-router";
import { WebHead } from '@/components/WebHead';
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from "react";
import { palette } from "@/constants/palette";
import "react-native-reanimated";
import { TamaguiProvider, Theme } from 'tamagui';
import tamaguiConfig from '../tamagui.config';

import { DialogHost } from '@/components/DialogHost';
import { ObservabilityProvider } from '@/components/ObservabilityProvider';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ViewAsBanner } from '@/components/ViewAsBanner';
import { WebSidebar } from '@/components/WebSidebar';
import { WebSideNav } from '@/components/nav/WebSideNav';
import { AuthProvider, useAuth } from "@/ctx/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { BRAND } from '@/constants/brand';
import { clearUserData } from '@/lib/clearUserData';
import { installWebAlert } from '@/lib/dialogs';
import { useRedesign } from '@/lib/flags';
import { initMonitoring } from '@/lib/monitoring';
import { asyncStoragePersister, queryClient } from '@/lib/react-query';
import { Platform, View } from 'react-native';

export { ErrorScreen as ErrorBoundary } from '@/components/ErrorScreen';

initMonitoring();
installWebAlert();

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { session, loading, passwordRecovery } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Signed out (button, expiry or another tab), or opened signed out: forget
  // the previous user's cached data. Bar iPads are shared.
  useEffect(() => {
    if (loading || session) return;
    clearUserData().catch((e) => console.warn('Clearing signed-out data failed', e));
  }, [loading, session]);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';
    // Privacy, terms and account-deletion pages must open without signing in,
    // and venue staff links (/v/<slug>) have their own branded sign-in. The
    // design gallery (/dev/gallery) shows no data and gates itself.
    if (segments[0] === 'legal' || segments[0] === 'v' || segments[0] === 'dev') return;
    const authScreen = segments.at(1);
    // stay on recovery / email-link routes while session is established
    const stayInAuth =
      authScreen === 'reset-password' ||
      authScreen === 'callback' ||
      passwordRecovery;

    if (passwordRecovery && authScreen !== 'reset-password') {
      router.replace('/auth/reset-password');
      return;
    }

    if (!session && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (session && inAuthGroup && !stayInAuth) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, passwordRecovery]);

  // ponytail: persistent web chrome — sidebar outside the stack so it never unmounts.
  // Phone-width web gets the phone tab bar instead (see the tabs layout).
  const isWideWeb = useIsWideWeb();
  const showWebSidebar = isWideWeb && !!session && segments[0] !== 'auth' && segments[0] !== 'v';
  const redesign = useRedesign();

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
        {showWebSidebar ? (redesign ? <WebSideNav /> : <WebSidebar />) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="v/[slug]" options={{ headerShown: false }} />
            <Stack.Screen
              name="menus/create/index"
              options={{ presentation: "modal", headerShown: false }}
            />
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
              name="import-cocktails"
              options={{ presentation: "modal", title: "Import Cocktails" }}
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
              name="profile/edit"
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
            <Stack.Screen name="test" options={{ headerShown: false }} />
          </Stack>
        </View>
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
  const [fontsLoaded] = useFonts({
    Inter: Inter_400Regular,
    InterMedium: Inter_500Medium,
    InterSemiBold: Inter_600SemiBold,
    InterBold: Inter_700Bold,
    // presentation accent for cocktail/menu titles — not system UI
    IBMPlexSansItalic: IBMPlexSans_600SemiBold_Italic,
  });
  // Native waits for fonts to avoid a flash of fallback text. Web renders
  // straight away (fonts arrive via CSS), so static export produces real HTML.
  if (!fontsLoaded && Platform.OS !== 'web') { return null; }
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={colorScheme === "dark" ? "dark" : "light"}>
      <Theme name={colorScheme === "dark" ? "dark" : "light"}>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister: asyncStoragePersister }}
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
