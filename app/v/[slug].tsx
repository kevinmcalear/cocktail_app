import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import Head from 'expo-router/head';
import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';
import { Button, Text, XStack, YStack, useTheme } from 'tamagui';

import { AuthShell, type AuthBrand } from '@/components/auth/AuthShell';
import { SignInScreen } from '@/components/auth/SignInScreen';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/ctx/AuthContext';
import { useBars } from '@/hooks/useBars';
import { useVenueBranding, type VenueBranding } from '@/hooks/useVenueBranding';
import { useVenueWebHead } from '@/hooks/useVenueWebHead';
import { installMode, promptInstall, subscribeInstall, type InstallMode } from '@/lib/webInstall';
import { useAppStore } from '@/store/useAppStore';

/**
 * A venue's staff link (/v/<slug>): sign in under the venue's name and logo,
 * add the venue's own app to the home screen, then open the app with the
 * venue selected. The installed app starts here too, and goes straight in.
 */
export default function VenueStaffLink() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const venueQuery = useVenueBranding(slug?.toLowerCase());
  const venue = venueQuery.data;
  const { session, loading: authLoading } = useAuth();

  useVenueWebHead(venue);

  const title = venue?.name ?? 'Staff link';
  const head = (
    <>
      <Stack.Screen options={{ headerShown: false, title }} />
      <Head>
        <title>{title}</title>
      </Head>
    </>
  );

  if (venueQuery.isPending || authLoading) {
    return (
      <>
        {head}
        <Loading />
      </>
    );
  }

  if (venueQuery.isError) {
    return (
      <>
        {head}
        <AuthShell title="Couldn't load this link" subtitle="Check your connection and try again.">
          <PrimaryButton label="Try again" onPress={() => void venueQuery.refetch()} />
        </AuthShell>
      </>
    );
  }

  if (!venue) {
    return (
      <>
        {head}
        <AuthShell
          title="Link not found"
          subtitle="This staff link doesn't match a venue. Ask your manager for a new one."
        >
          <HomeButton />
        </AuthShell>
      </>
    );
  }

  const brand: AuthBrand = { name: venue.name, logoUrl: venue.logo_url };

  if (!session) {
    return (
      <>
        {head}
        <SignInScreen brand={brand} subtitle={`Drinks, menus and training for the ${venue.name} team.`} />
      </>
    );
  }

  return (
    <>
      {head}
      <MemberGate venue={venue} brand={brand} />
    </>
  );
}

/** Signed in: check the user is on the venue's team, then offer the install. */
function MemberGate({ venue, brand }: { venue: VenueBranding; brand: AuthBrand }) {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { data: bars, isPending, isError, refetch } = useBars();
  const setSelectedContextIds = useAppStore((s) => s.setSelectedContextIds);
  const markContextDefaultApplied = useAppStore((s) => s.markContextDefaultApplied);
  const mode = useInstallMode();

  const isMember = !!bars?.some((b) => b.bar_id === venue.id);

  const enter = useCallback(() => {
    setSelectedContextIds([venue.id]);
    markContextDefaultApplied();
    router.replace('/(tabs)');
  }, [venue.id, setSelectedContextIds, markContextDefaultApplied, router]);

  // Opened from the home screen: nothing to install, go straight in.
  useEffect(() => {
    if (isMember && mode === 'installed') enter();
  }, [isMember, mode, enter]);

  if (isPending || (isMember && mode === 'installed')) return <Loading />;

  if (isError) {
    return (
      <AuthShell brand={brand} title="Couldn't check your access" subtitle="Check your connection and try again.">
        <PrimaryButton label="Try again" onPress={() => void refetch()} />
      </AuthShell>
    );
  }

  if (!isMember) {
    return (
      <AuthShell
        brand={brand}
        title="You're not on this team yet"
        subtitle={`You're signed in as ${user?.email ?? 'someone else'}. Ask a ${venue.name} manager to add that email, then open this link again.`}
      >
        <YStack gap="$3">
          <PrimaryButton label="Use a different account" onPress={() => void signOut()} />
          <HomeButton />
        </YStack>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      brand={brand}
      title={`Add ${venue.name} to your home screen`}
      subtitle="Open the drinks, menus and training in one tap, like any other app."
    >
      <YStack gap="$4">
        <InstallSteps mode={mode} venueName={venue.name} />
        <Button
          chromeless
          onPress={enter}
          height={44}
          borderRadius={8}
          borderWidth={1}
          borderColor="$borderColor"
        >
          <Text color="$color" fontWeight="600" fontSize={15}>
            {mode === 'desktop' ? 'Continue' : 'Continue in the browser'}
          </Text>
        </Button>
      </YStack>
    </AuthShell>
  );
}

function InstallSteps({ mode, venueName }: { mode: InstallMode; venueName: string }) {
  const theme = useTheme();
  const muted = theme.color11?.get() as string;

  if (mode === 'prompt') {
    return <PrimaryButton label={`Install ${venueName}`} onPress={() => void promptInstall()} />;
  }

  if (mode === 'ios') {
    return (
      <YStack gap="$3">
        <Step number={1}>
          <XStack alignItems="center" gap="$1.5" flexWrap="wrap">
            <Text fontSize={15} color="$color">
              Tap
            </Text>
            <IconSymbol name="square.and.arrow.up" size={18} color={muted} />
            <Text fontSize={15} color="$color">
              Share in the browser bar.
            </Text>
          </XStack>
        </Step>
        <Step number={2}>
          <XStack alignItems="center" gap="$1.5" flexWrap="wrap">
            <Text fontSize={15} color="$color">
              Choose
            </Text>
            <IconSymbol name="plus.square" size={18} color={muted} />
            <Text fontSize={15} color="$color" fontWeight="600">
              Add to Home Screen.
            </Text>
          </XStack>
        </Step>
        <Step number={3}>
          <Text fontSize={15} color="$color">
            Tap Add. {venueName} is now on your home screen.
          </Text>
        </Step>
      </YStack>
    );
  }

  if (mode === 'android') {
    return (
      <YStack gap="$3">
        <Step number={1}>
          <Text fontSize={15} color="$color">
            Open the browser menu (⋮).
          </Text>
        </Step>
        <Step number={2}>
          <Text fontSize={15} color="$color">
            Choose <Text fontWeight="600">Add to Home screen</Text> or <Text fontWeight="600">Install app</Text>.
          </Text>
        </Step>
        <Step number={3}>
          <Text fontSize={15} color="$color">
            Tap Add. {venueName} is now on your home screen.
          </Text>
        </Step>
      </YStack>
    );
  }

  return (
    <Text fontSize={15} color="$color11" lineHeight={22}>
      Open this link on your phone to put {venueName} on your home screen. On a computer, you can
      keep using it here.
    </Text>
  );
}

function Step({ number, children }: { number: number; children: ReactNode }) {
  return (
    <XStack gap="$3" alignItems="center">
      <YStack
        width={26}
        height={26}
        borderRadius={13}
        backgroundColor="$color8"
        alignItems="center"
        justifyContent="center"
      >
        <Text color="$backgroundStrong" fontWeight="700" fontSize={13}>
          {number}
        </Text>
      </YStack>
      <YStack flex={1}>{children}</YStack>
    </XStack>
  );
}

/** Tracks the browser's install options (Chrome's prompt can arrive late). */
function useInstallMode(): InstallMode {
  return useSyncExternalStore(subscribeInstall, installMode, () => 'desktop' as InstallMode);
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Button backgroundColor="$color8" onPress={onPress} borderRadius={8} height={44}>
      <Text color="$backgroundStrong" fontWeight="700" fontSize={15}>
        {label}
      </Text>
    </Button>
  );
}

function HomeButton() {
  const router = useRouter();
  return (
    <Button chromeless onPress={() => router.replace('/')} height={44}>
      <Text color="$color8" fontWeight="600" fontSize={15}>
        Go to home
      </Text>
    </Button>
  );
}

function Loading() {
  const theme = useTheme();
  return (
    <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
      <ActivityIndicator color={theme.color11?.get() as string} />
    </YStack>
  );
}
