import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Caption, GlassButton, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { useSignedIn } from '@/ctx/AuthContext';
import { isUnclaimed, useProfile, type Profile } from '@/hooks/useProfiles';
import { recentEntry, useTrackRecent } from '@/hooks/useTrackRecent';
import { saveClaimReturn } from '@/lib/claimReturn';
import { siteOrigin } from '@/lib/venueLink';

import { LoveBarButton } from '../kept/LoveBarButton';
import { PublicPage } from '../published/PublicChrome';
import { SignInCard } from '../published/SignInCard';
import { BlockedProfileNote, ProfileSafety } from '../safety/ProfileSafety';
import { BarProfile } from './BarProfile';
import { MakerProfile } from './MakerProfile';
import { PersonProfile } from './PersonProfile';
import { PublicBarPage } from './PublicBarPage';
import { SupplierProfile } from './SupplierProfile';
import { ThisIsMe } from './ThisIsMe';
import { UnclaimedPerson } from './UnclaimedPerson';
import { useShareLink } from './useShareLink';

/**
 * A public profile: a person or a bar, the same kind of page (a maker's has
 * its own, MakerProfile, and so does a supplier's, SupplierProfile). Who they are, the drinks credited to them, and the
 * bars that put those drinks on a menu (the credit that matters most). A
 * person who chooses to can show the drinks they've had, with their scores.
 */
export function ProfileScreen({ profileRef, checking = false }: { profileRef: string | string[] | undefined; checking?: boolean }) {
  return (
    <BackbarTheme>
      <ProfilePage profileRef={profileRef} checking={checking} />
    </BackbarTheme>
  );
}

/** checking: still asking whether a missing page was merged into someone's, so it isn't "no profile" yet. */
function ProfilePage({ profileRef, checking }: { profileRef: string | string[] | undefined; checking: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const breakpoint = useBreakpoint();
  const signedIn = useSignedIn();
  const { data: profile, isLoading, error } = useProfile(profileRef);
  // A person's page is for people who've signed in; a bar's opens to anyone.
  const gated = profile?.kind === 'person' && !signedIn;
  // Opened from a search: the way back carries it ("martini", disc-search-bar).
  const { q, claim } = useLocalSearchParams<{ q?: string; claim?: string }>();
  // "Claim it on your phone" opened signed out: the claim opens again once they've signed in.
  const claimAfterSignIn = profile && gated && claim === '1' && isUnclaimed(profile) ? profile.handle || profile.id : null;
  useEffect(() => {
    if (claimAfterSignIn) void saveClaimReturn(claimAfterSignIn);
  }, [claimAfterSignIn]);
  const searched = typeof q === 'string' && q.trim() ? q.trim() : null;
  // A bar you open shows in Search's Recent.
  useTrackRecent(profile?.kind === 'bar', profile ? recentEntry('bar', profile.id, profile.display_name, { href: `/p/${profile.handle || profile.id}`, imageUrl: profile.avatar_url, barId: null }) : null);
  if (profile?.kind === 'bar' && !signedIn) return <PublicBarPage profile={profile} />; // signed out: the public web's one bar page (ppl-pub-bar-*)
  // Signed in on a tablet or desktop, a bar's page is the drawn desktop one (ppl-pub-bar-desktop): its actions sit under the name.
  const wideBar = profile?.kind === 'bar' && breakpoint !== 'phone';
  // Someone's page nobody has claimed: This is me and Not me pinned to the bottom of a phone (find-yourself).
  const unclaimedPerson = !!profile && profile.kind === 'person' && isUnclaimed(profile) && !gated;
  const pinned = unclaimedPerson && breakpoint === 'phone';

  const controls = (
    <View style={[styles.controls, { top: insets.top + space.sm, left: gutter, right: gutter }]}>
      <GlassButton
        accessibilityLabel={searched ? `Back to the search for ${searched}` : 'Back'}
        label={searched ?? undefined}
        icon={Platform.OS === 'web' || searched ? 'chevron.left' : 'xmark'}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      {profile && !gated && !wideBar ? (
        <View style={styles.right}>
          <ShareProfile profile={profile} />
          {/* A bar's Love sits beside Share (ppl-bar-top); Hide is in More (disc-hide-bar). */}
          {profile.kind === 'bar' ? <LoveBarButton profileId={profile.id} name={profile.display_name} labelled /> : null}
          <ProfileSafety profile={profile} />
        </View>
      ) : null}
    </View>
  );

  let body;
  if (profile && claimAfterSignIn) body = <SignInCard title={`Claim ${profile.display_name}`} text="Sign in with your own email. The claim opens here once you have." replace />;
  else if (profile && gated) body = <SignInCard text={`Sign in to see ${profile.display_name}’s profile: the drinks they’ve made, where they’ve worked and what they’re drinking.`} />;
  else if (profile) {
    const columns = breakpoint === 'phone' ? 2 : breakpoint === 'tablet' ? 3 : 4;
    body =
      profile.kind === 'maker' ? (
        <MakerProfile profile={profile} columns={columns} />
      ) : profile.kind === 'supplier' ? (
        <SupplierProfile profile={profile} />
      ) : unclaimedPerson ? (
        <UnclaimedPerson profile={profile} />
      ) : profile.kind === 'person' ? (
        <PersonProfile profile={profile} columns={columns} />
      ) : wideBar ? (
        <PublicBarPage profile={profile} signedIn />
      ) : (
        <BarProfile profile={profile} columns={columns} />
      );
  }
  else if (isLoading || checking) body = <Caption tone="muted" accessibilityLabel="Loading profile">Loading…</Caption>;
  else
    body = (
      <BlockedProfileNote profileRef={profileRef}>
        <Body tone="muted">{error ? "Couldn't load this profile. Check your connection and try again." : "There's no public profile here. It may be private or the link may be wrong."}</Body>
      </BlockedProfileNote>
    );

  // Signed out, every page here wears the website's nav and footer, like a bar's (p05): a person's sign-in prompt, a maker's, a supplier's.
  if (!signedIn) {
    return (
      <PublicPage title={profile?.display_name ?? 'Profile'}>
        <View style={styles.readable}>{body}</View>
      </PublicPage>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + layout.minTapTarget + space.xl, paddingBottom: insets.bottom + space.xxxl + (pinned ? PINNED_ROOM : 0), paddingHorizontal: gutter }}>
        <View style={[styles.readable, wideBar ? styles.wide : null]}>{body}</View>
      </ScrollView>
      {controls}
      {pinned && profile ? <ThisIsMe profile={profile} pinned /> : null}
    </View>
  );
}

/** Share profile, top right on a person's or a bar's page (ppl-person, ppl-bar-top). */
function ShareProfile({ profile }: { profile: Profile }) {
  const share = useShareLink(`${siteOrigin()}/p/${profile.handle}`, profile.display_name);
  return <GlassButton accessibilityLabel={profile.kind === 'person' ? 'Share profile' : 'Share'} icon="square.and.arrow.up" onPress={() => void share()} />;
}

/** Room under the page for the pinned This is me and Not me. */
const PINNED_ROOM = 120;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  readable: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  // A bar's desktop page runs to the board's 1240 less its 32 gutters.
  wide: { maxWidth: 1176 },
  controls: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between' },
  right: { flexDirection: 'row', gap: space.sm },
});
