import { IBMPlexSans_400Regular, IBMPlexSans_600SemiBold_Italic, IBMPlexSans_700Bold, useFonts } from '@expo-google-fonts/ibm-plex-sans';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import { TamaguiProvider } from 'tamagui';
import tamaguiConfig from '../tamagui.config';

import { OfflineBanner } from '@/components/OfflineBanner';
import { AuthProvider, useAuth } from "@/ctx/AuthContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { asyncStoragePersister, queryClient } from '@/lib/react-query';

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!session && !inAuthGroup) {
      // Redirect to the sign-in page.
      router.replace('/auth/login');
    } else if (session && inAuthGroup) {
      // Redirect away from the sign-in page.
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
        <Stack.Screen
          name="menus/create/index"
          options={{ presentation: "modal", headerShown: false }}
        />
        <Stack.Screen
          name="add-cocktail"
          options={{ presentation: "fullScreenModal", headerShown: false }}
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
        <Stack.Screen name="test" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({ 
    IBMPlexSans: IBMPlexSans_400Regular,
    IBMPlexSansBold: IBMPlexSans_700Bold,
    IBMPlexSansItalic: IBMPlexSans_600SemiBold_Italic,
  });
  if (!fontsLoaded) { return null; }
  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={colorScheme === "dark" ? "dark" : "light"}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: asyncStoragePersister }}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <BottomSheetModalProvider>
            <AuthProvider>
              <OfflineBanner />
              <RootLayoutNav />
            </AuthProvider>
          </BottomSheetModalProvider>
        </GestureHandlerRootView>
      </PersistQueryClientProvider>
    </TamaguiProvider>
  );
}
