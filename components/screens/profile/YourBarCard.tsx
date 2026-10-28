import { useRouter, type Href } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, useDs } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useBars } from '@/hooks/useBars';
import { useUserId } from '@/ctx/AuthContext';
import { useAskToJoin, useMyJoinRequest } from '@/hooks/useJoinRequests';
import { useMyPersonClaim, useProfile, type Position } from '@/hooks/useProfiles';
import { deviceStore } from '@/lib/deviceStore';
import { plural } from '@/lib/menus';
import { siteOrigin } from '@/lib/venueLink';

import { BarMark } from '../home/BarMark';
import { useShareLink } from './useShareLink';

/** Long enough to open You after the approval; an old claim isn't news. */
const NEWS_MS = 14 * 24 * 60 * 60 * 1000;

/** A claim on your page approved in the last two weeks, while it's still news; else null. */
export function useClaimNews() {
  const claim = useMyPersonClaim().data;
  const [now] = useState(() => Date.now());
  // From the approval: a claim that waited a while is still news when it lands.
  return claim?.status === 'approved' && now - Date.parse(claim.reviewed_at ?? claim.created_at) < NEWS_MS ? claim : null;
}

/**
 * "It's you. 5 drinks are now credited to your account. 1 more waits for your
 * yes." at the top of You, once, the first time you open it after a claim on
 * your page is approved (find-yourself step 6).
 */
export function ItsYou({ drinks, waiting = 0 }: { drinks: number; waiting?: number }) {
  const userId = useUserId();
  const approved = useClaimNews()?.id ?? null;
  const seenKey = `its-you-seen-${userId}`;
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!approved) return;
    let live = true;
    void deviceStore
      .getItem(seenKey)
      .then((seen) => {
        if (!live || seen === approved) return;
        setShow(true);
        return deviceStore.setItem(seenKey, approved);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [approved, seenKey]);
  if (!show) return null;
  return (
    <Body role="status" align="center" tone="accent">
      {drinks ? `It’s you. ${plural(drinks, 'drink')} ${drinks === 1 ? 'is' : 'are'} now credited to your account.` : 'It’s you. The page is yours now.'}
      {waiting ? ` ${drinks ? `${waiting} more` : plural(waiting, 'drink')} ${waiting === 1 ? 'waits' : 'wait'} for your yes.` : ''}
    </Body>
  );
}

/**
 * The bar you work at, one tap away (find-yourself step 6): while nobody has
 * claimed it, "I run Pale Moth" (Venue setup) and "Send it to whoever does"
 * (its claim link); once it's claimed, "Ask to join Pale Moth's team", which
 * its Admin accepts. Nothing once you're on the team, or with no current job.
 */
export function YourBarCard({ positions }: { positions: Position[] }) {
  const ds = useDs();
  const router = useRouter();
  const job = positions.find((p) => p.is_current && p.person_accepted);
  const { data: bar } = useProfile(job?.bar.id ?? null);
  const venueId = bar?.kind === 'bar' ? bar.bar_id : null;
  const myVenues = useBars().data ?? [];
  const onTeam = !!venueId && myVenues.some((m) => m.bar_id === venueId);
  const asked = useMyJoinRequest(venueId).data;
  const ask = useAskToJoin();
  const share = useShareLink(`${siteOrigin()}/p/${bar?.handle || bar?.id}/claim`, `Claim ${bar?.display_name ?? 'the bar'} on Cocktail`);
  if (!job || !bar || bar.kind !== 'bar' || onTeam) return null;
  const name = bar.display_name;

  let title: string;
  let body: string;
  let actions: ReactNode = null;
  if (!venueId) {
    title = `${name} isn’t claimed yet`;
    body = 'Whoever runs it can claim it. Then your drinks show on its menus with you as the maker, and the team gets the venue app.';
    actions = (
      <View style={styles.actions}>
        <Button label={`I run ${name}`} onPress={() => router.push(`/venue-setup?claim=${bar.id}` as Href)} />
        <Button label="Send it to whoever does" variant="secondary" icon="square.and.arrow.up" onPress={() => void share()} />
      </View>
    );
  } else if (asked?.declined_at) {
    title = `${name}’s team said no`;
    body = `Ask ${name}’s Admin for an invite if that was a mistake.`;
  } else if (asked) {
    title = `You asked to join ${name}’s team`;
    body = `${name}’s Admin answers. You get the venue app once they say yes.`;
  } else {
    title = `Ask to join ${name}’s team`;
    body = 'Its Admin adds you as a Bartender: the venue app, its specs and its menus.';
    actions = (
      <View style={styles.actions}>
        <Button label={ask.isPending ? 'Asking…' : 'Ask to join'} disabled={ask.isPending} onPress={() => ask.mutate(bar.id)} />
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}>
      <BarMark name={name} logoUrl={bar.avatar_url} size={44} profileId={bar.id} />
      <View style={styles.flex}>
        <Body style={styles.strong}>{title}</Body>
        <Caption tone="muted">{body}</Caption>
        {actions}
        {ask.error ? (
          <Caption tone="accent" role="alert">
            {ask.error.message}
          </Caption>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0, gap: space.xs },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
});
