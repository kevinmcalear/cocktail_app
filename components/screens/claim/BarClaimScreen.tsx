import { useRouter, type Href } from 'expo-router';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackbarTheme, Body, Button, Caption, GlassButton, useDs, useGutter } from '@/components/ds';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useMyClaims, useProfile } from '@/hooks/useProfiles';
import { claimPlace } from '@/lib/claimVerification';

import { ClaimStart } from './ClaimStart';
import { ClaimApproved, ClaimPending } from './ClaimStatus';

/**
 * "Claim this page" for a bar: pick how we check it's yours, do it, then
 * wait (or, for a strong work email, it's yours on the spot). Shows where a
 * claim stands when you come back: waiting, approved, or turned down with
 * the moderator's reason.
 */
export function BarClaimScreen({ profileRef }: { profileRef: string }) {
  return (
    <BackbarTheme>
      <ClaimPage profileRef={profileRef} />
    </BackbarTheme>
  );
}

function ClaimPage({ profileRef }: { profileRef: string }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const userId = useUserId();
  const { data: profile, isLoading, error } = useProfile(profileRef);
  const { data: claims, isLoading: claimsLoading } = useMyClaims(profile?.id);
  const latest = claims?.[0];

  const body = (() => {
    if (isLoading || (profile && userId && claimsLoading)) return <Caption tone="muted">Loading…</Caption>;
    if (error) return <Body tone="muted">Couldn’t load this page. Check your connection and try again.</Body>;
    if (!profile || profile.kind === 'person') return <Body tone="muted">There’s no bar or maker page here to claim.</Body>;
    if (!userId) {
      return (
        <View style={styles.gap}>
          <Body>{`Sign in to claim ${profile.display_name}. Use your work email if you have one at the ${claimPlace(profile.kind)}’s own domain: that’s the quickest way.`}</Body>
          <Button label="Sign in" onPress={() => router.push('/auth/login' as Href)} style={styles.hug} />
        </View>
      );
    }
    if (latest?.status === 'approved') return <ClaimApproved profile={profile} />;
    if (profile.is_claimed) {
      return <Body tone="muted">{`${profile.display_name} has already been claimed. If you work there, ask one of its Admins to invite you.`}</Body>;
    }
    if (latest?.status === 'pending') return <ClaimPending claim={latest} profile={profile} />;
    return <ClaimStart profile={profile} declined={latest?.status === 'rejected' ? latest : null} />;
  })();

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>{profile ? `Claim ${profile.display_name}` : 'Claim a bar'}</title>
      </WebHead>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingTop: insets.top + layout.minTapTarget + space.xl, paddingBottom: insets.bottom + space.xxxl, paddingHorizontal: gutter }}
      >
        <View style={styles.readable}>{body}</View>
      </ScrollView>
      <View style={[styles.controls, { top: insets.top + space.sm, left: gutter }]}>
        <GlassButton
          accessibilityLabel="Back"
          icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
          onPress={() => (router.canGoBack() ? router.back() : router.replace(profile ? (`/p/${profile.handle}` as Href) : '/'))}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  readable: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  controls: { position: 'absolute' },
  gap: { gap: space.md },
  hug: { alignSelf: 'flex-start' },
});
