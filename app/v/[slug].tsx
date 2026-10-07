import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { WebHead } from '@/components/WebHead';
import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthShell, AuthSpinner, type AuthBrand } from '@/components/auth/AuthShell';
import { StaffLinkSignIn } from '@/components/auth/StaffLinkSignIn';
import { BackbarTheme, Body, BrandProvider, Button, Caption, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { InviteWelcome } from '@/components/screens/onboarding/InviteWelcome';
import { useMyInvites } from '@/hooks/useBarInvites';
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
      <WebHead>
        <title>{title}</title>
      </WebHead>
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

  return (
    <BrandProvider accent={venue.primary_color ?? undefined}>
      {head}
      {session ? (
        <MemberGate venue={venue} brand={brand} />
      ) : (
        <StaffLinkSignIn slug={venue.slug} brand={brand} />
      )}
    </BrandProvider>
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
  const invites = useMyInvites(!isPending && !isMember);
  const invite = invites.data?.find((i) => i.bar_id === venue.id) ?? null;

  const enter = useCallback(() => {
    setSelectedContextIds([venue.id]);
    markContextDefaultApplied();
    router.replace('/(tabs)');
  }, [venue.id, setSelectedContextIds, markContextDefaultApplied, router]);

  // Opened from the home screen: nothing to install, go straight in.
  useEffect(() => {
    if (isMember && mode === 'installed') enter();
  }, [isMember, mode, enter]);

  if (isPending || invites.isLoading || (isMember && mode === 'installed')) return <Loading />;

  if (isError) {
    return (
      <AuthShell brand={brand} title="Couldn't check your access" subtitle="Check your connection and try again.">
        <PrimaryButton label="Try again" onPress={() => void refetch()} />
      </AuthShell>
    );
  }

  // Joining makes them a member, and the install step below takes over.
  if (!isMember && invite) return <InviteWelcome invite={invite} setUp onJoined={() => {}} onDeclined={() => router.replace('/(tabs)')} />;

  if (!isMember) {
    return (
      <AuthShell
        brand={brand}
        title="You're not on this team yet"
        subtitle={`You're signed in as ${user?.email ?? 'someone else'}. Ask a ${venue.name} manager to invite that email, then open this link again.`}
      >
        <PrimaryButton label="Use a different account" onPress={() => void signOut()} />
        <HomeButton />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      brand={brand}
      title={`Add ${venue.name} to your home screen`}
      subtitle="Open the drinks, menus and training in one tap, like any other app."
    >
      <InstallSteps mode={mode} venueName={venue.name} />
      <Button label={mode === 'desktop' ? 'Continue' : 'Continue in the browser'} variant="secondary" size="lg" onPress={enter} />
    </AuthShell>
  );
}

function InstallSteps({ mode, venueName }: { mode: InstallMode; venueName: string }) {
  const ds = useDs();

  if (mode === 'prompt') {
    return <PrimaryButton label={`Install ${venueName}`} onPress={() => void promptInstall()} />;
  }

  if (mode === 'ios') {
    return (
      <View style={styles.steps}>
        <Step number={1}>
          <View style={styles.inline}>
            <Body>Tap</Body>
            <IconSymbol name="square.and.arrow.up" size={18} color={ds.c.muted} />
            <Body>Share in the browser bar.</Body>
          </View>
        </Step>
        <Step number={2}>
          <View style={styles.inline}>
            <Body>Choose</Body>
            <IconSymbol name="plus.square" size={18} color={ds.c.muted} />
            <Body style={styles.strong}>Add to Home Screen.</Body>
          </View>
        </Step>
        <Step number={3}>
          <Body>Tap Add. {venueName} is now on your home screen.</Body>
        </Step>
      </View>
    );
  }

  if (mode === 'android') {
    return (
      <View style={styles.steps}>
        <Step number={1}>
          <Body>Open the browser menu (⋮).</Body>
        </Step>
        <Step number={2}>
          <Body>
            Choose <Body style={styles.strong}>Add to Home screen</Body> or <Body style={styles.strong}>Install app</Body>.
          </Body>
        </Step>
        <Step number={3}>
          <Body>Tap Add. {venueName} is now on your home screen.</Body>
        </Step>
      </View>
    );
  }

  return (
    <Body tone="muted">
      Open this link on your phone to put {venueName} on your home screen. On a computer, you can keep using it here.
    </Body>
  );
}

function Step({ number, children }: { number: number; children: ReactNode }) {
  const ds = useDs();
  return (
    <View style={styles.step}>
      <View style={[styles.stepNumber, { backgroundColor: ds.accentFill.fill }]}>
        <Caption tone="onAccent">{number}</Caption>
      </View>
      <View style={styles.fill}>{children}</View>
    </View>
  );
}

/** Tracks the browser's install options (Chrome's prompt can arrive late). */
function useInstallMode(): InstallMode {
  return useSyncExternalStore(subscribeInstall, installMode, () => 'desktop' as InstallMode);
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Button label={label} size="lg" onPress={onPress} />;
}

function HomeButton() {
  const router = useRouter();
  return <Button label="Go to home" variant="ghost" onPress={() => router.replace('/')} />;
}

function Loading() {
  const ds = useDs();
  return (
    <BackbarTheme>
      <View style={[styles.loading, { backgroundColor: ds.c.ground }]}>
        <AuthSpinner />
      </View>
    </BackbarTheme>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  steps: { gap: space.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stepNumber: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  strong: { fontFamily: fontFamilies.bodySemiBold },
});
