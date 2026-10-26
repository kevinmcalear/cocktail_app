import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, TextLink, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { useAuth } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { isUnclaimed, useMyClaims, useMyPersonClaim, type Profile } from '@/hooks/useProfiles';
import { needsOnboarding } from '@/lib/onboarding';

import { claimBar } from './ClaimProfile';

/**
 * The claim on a bar page that isn't claimed yet, under its name and before
 * its menus (owner-setup step 3, call 3). Opened from Setup's "Find your bar"
 * (?owner=1): "Is this your bar?" as a card, Claim running venue setup for it
 * and Not mine going back to the search. A claim already sent says so.
 * Everyone else finds the claim in More and at the page's end (ClaimLine, Q33).
 */
export function BarClaimCard({ profile }: { profile: Profile }) {
  const ds = useDs();
  const router = useRouter();
  const { user } = useAuth();
  const owner = useLocalSearchParams<{ owner?: string }>().owner === '1';
  const { data: claims } = useMyClaims(user ? profile.id : null);
  const [notMine, setNotMine] = useState(false);
  if (!isUnclaimed(profile) || notMine) return null;
  const name = profile.display_name;
  const claim = () => (user ? claimBar(router, profile.id, needsOnboarding(user.user_metadata)) : router.push('/auth/login' as Href));

  if (claims?.[0]?.status === 'pending') {
    return (
      <View style={styles.line}>
        <Caption tone="muted">Your claim is being checked.</Caption>
        <TextLink label="See your claim" onPress={() => router.push(`/p/${profile.id}/claim` as Href)} />
      </View>
    );
  }
  if (!owner) return null;
  const rejected = claims?.[0]?.status === 'rejected' ? <Caption tone="muted">Your last claim wasn’t approved. You can try another way.</Caption> : null;
  return (
    <View style={[styles.card, { backgroundColor: withAlpha(ds.accentText, 0.12), borderColor: withAlpha(ds.accentText, 0.45) }]}>
      <Headline role="heading">Is this your bar?</Headline>
      {rejected}
      <Body tone="muted">Claim it and set it up now. We check it’s yours while you work: an Instagram message, a call, or a website already on this page.</Body>
      <View style={styles.buttons}>
        <Button label={`Claim ${name}`} dense onPress={claim} />
        <Button label="Not mine" variant="secondary" dense onPress={() => (router.canGoBack() ? router.back() : setNotMine(true))} />
      </View>
    </View>
  );
}

/**
 * The claim prompts' quiet line at the very end of a bar's page (Q33 B,
 * approved 26 Oct 2026): "Run Pale Moth or work there? Claim this page · Find
 * your name". Claim runs venue setup for the bar; Find your name (`onFind`,
 * a phone's People tab) is for anyone who hasn't claimed a person's page.
 * Nothing for its own team.
 */
export function ClaimLine({ profile, onFind }: { profile: Profile; onFind?: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const { data: claims } = useMyClaims(user ? profile.id : null);
  const { data: person, isPending } = useMyPersonClaim();
  const onTeam = useActiveVenue().venues.some((v) => v.id === profile.bar_id);
  const canClaim = isUnclaimed(profile) && claims?.[0]?.status !== 'pending';
  const canFind = !!onFind && !!user && !isPending && !person;
  if (onTeam || (!canClaim && !canFind)) return null;
  const name = profile.display_name;
  const ask = canClaim && canFind ? `Run ${name} or work there?` : canClaim ? `Run ${name}?` : `Worked at ${name}?`;
  const claim = () => (user ? claimBar(router, profile.id, needsOnboarding(user.user_metadata)) : router.push('/auth/login' as Href));
  return (
    <View style={styles.line}>
      <Caption tone="muted">{ask}</Caption>
      {canClaim ? <TextLink label="Claim this page" accessibilityHint="Set it up and prove it’s yours" onPress={claim} /> : null}
      {canClaim && canFind ? <Caption tone="muted">·</Caption> : null}
      {canFind ? <TextLink label="Find your name" accessibilityHint="Opens the people listed here" onPress={onFind} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.sm },
});
