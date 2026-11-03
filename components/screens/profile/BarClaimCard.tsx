import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, TextLink, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { useAuth } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useClaimPending } from '@/hooks/useBarClaims';
import { useAskToJoin, useMyJoinRequest } from '@/hooks/useJoinRequests';
import { isUnclaimed, useMyClaims, useMyPersonClaim, type Profile } from '@/hooks/useProfiles';
import { needsOnboarding } from '@/lib/onboarding';

import { claimBar } from './ClaimProfile';

/**
 * The claim on a bar page that isn't claimed yet, under its name and before
 * its menus (owner-setup step 3, call 3). Opened from Setup's "Find your bar"
 * (?owner=1): "Is this your bar?" as a card, Claim running venue setup for it
 * and Not mine going back to the search. A claim already sent says so.
 * Someone else's waiting claim is shown, and another can still be sent: a
 * moderator picks between them (Kevin, 3 Nov 2026).
 * Everyone else finds the claim in More and at the page's end (ClaimLine, Q33).
 */
export function BarClaimCard({ profile }: { profile: Profile }) {
  const ds = useDs();
  const router = useRouter();
  const { user } = useAuth();
  const owner = useLocalSearchParams<{ owner?: string }>().owner === '1';
  const { data: claims } = useMyClaims(user ? profile.id : null);
  const othersWaiting = useClaimPending(isUnclaimed(profile) ? profile.id : null).data ?? false;
  const [notMine, setNotMine] = useState(false);
  if (!isUnclaimed(profile) || notMine) return null;
  const name = profile.display_name;
  const claim = () => (user ? claimBar(router, profile.id, needsOnboarding(user.user_metadata)) : router.push('/auth/login' as Href));

  if (claims?.[0]?.status === 'pending') {
    return (
      <View style={styles.line}>
        <Caption tone="muted">Claim sent, waiting for approval.</Caption>
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
      {othersWaiting ? <Caption tone="muted">Someone has already sent a claim. You can send yours too: a moderator picks.</Caption> : null}
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
 * A waiting claim is noted, and the claim stays open to others. Once a claim
 * is approved, the staff door takes its place: "Work here? Ask to join".
 * Nothing for its own team.
 */
export function ClaimLine({ profile, onFind }: { profile: Profile; onFind?: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const { data: claims } = useMyClaims(user ? profile.id : null);
  const { data: person, isPending } = useMyPersonClaim();
  const onTeam = useActiveVenue().venues.some((v) => v.id === profile.bar_id);
  const canClaim = isUnclaimed(profile) && claims?.[0]?.status !== 'pending';
  const waiting = useClaimPending(canClaim ? profile.id : null).data ?? false;
  const canFind = !!onFind && !!user && !isPending && !person;
  const door = !!user && !!profile.bar_id && !onTeam;
  if (onTeam) return null;
  if (door) return <StaffDoor profile={profile} barId={profile.bar_id!} onFind={canFind ? onFind : undefined} />;
  if (!canClaim && !canFind) return null;
  const name = profile.display_name;
  const ask = canClaim && canFind ? `Run ${name} or work there?` : canClaim ? `Run ${name}?` : `Worked at ${name}?`;
  const claim = () => (user ? claimBar(router, profile.id, needsOnboarding(user.user_metadata)) : router.push('/auth/login' as Href));
  return (
    <View style={styles.line}>
      <Caption tone="muted">{ask}</Caption>
      {canClaim ? <TextLink label="Claim this page" accessibilityHint="Set it up and prove it’s yours" onPress={claim} /> : null}
      {canClaim && waiting ? <Caption tone="muted">(a claim is waiting)</Caption> : null}
      {canClaim && canFind ? <Caption tone="muted">·</Caption> : null}
      {canFind ? <TextLink label="Find your name" accessibilityHint="Opens the people listed here" onPress={onFind} /> : null}
    </View>
  );
}

/** A claimed bar's page, for someone not on its team: "Work here? Ask to join", which its Admin answers. */
function StaffDoor({ profile, barId, onFind }: { profile: Profile; barId: string; onFind?: () => void }) {
  const asked = useMyJoinRequest(barId).data;
  const ask = useAskToJoin();
  return (
    <View style={styles.line}>
      <Caption tone="muted">Work here?</Caption>
      {asked ? (
        <Caption tone="muted">{asked.declined_at ? 'The team said no.' : 'You asked to join.'}</Caption>
      ) : (
        <TextLink label={ask.isPending ? 'Asking…' : 'Ask to join'} accessibilityHint={`Asks ${profile.display_name}’s Admin to add you to the team`} onPress={() => ask.mutate(profile.id)} />
      )}
      {onFind ? <Caption tone="muted">·</Caption> : null}
      {onFind ? <TextLink label="Find your name" accessibilityHint="Opens the people listed here" onPress={onFind} /> : null}
      {ask.error ? (
        <Caption tone="accent" role="alert">
          {ask.error.message}
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.sm },
});
