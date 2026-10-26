import { StyleSheet, View } from 'react-native';

import { Body, Headline, useDs } from '@/components/ds';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useLikelyAtBar } from '@/hooks/useLikelyClaimer';
import { useMyPersonClaim, type Original, type Profile } from '@/hooks/useProfiles';

/**
 * "See your name? Tap it." on a bar's page (owner-setup step 3; find-yourself
 * step 2), for someone signed in who hasn't claimed a person's page: the
 * credits are links to it. Only for the likely person (Q33, approved 26 Oct
 * 2026): their name is on the bar's drinks or people, or they said in setup
 * they work in bars. Everyone else has Find your name in More and at the
 * page's end. `card`: a phone's card under the name; else a line under the
 * menus (the desktop page). Claiming the bar itself is BarClaimCard's.
 */
export function SeeYourName({ bar, originals, card = false }: { bar: Pick<Profile, 'id' | 'kind'>; originals: readonly Original[]; card?: boolean }) {
  const ds = useDs();
  const { user } = useAuth();
  const { data: claim, isPending } = useMyPersonClaim();
  const likely = useLikelyAtBar(bar, originals);
  if (!user || isPending || claim || !likely) return null;
  if (card) {
    return (
      <View role="region" accessibilityLabel="See your name" style={[styles.card, { backgroundColor: ds.c.raised, borderColor: ds.c.lineStrong }]}>
        <Headline role="heading">See your name? Tap it.</Headline>
        <Body tone="muted">Every drink credited to you is on your page, from every bar.</Body>
      </View>
    );
  }
  return (
    <Body tone="muted">
      {'Worked here? '}
      <Body style={styles.strong}>See your name? Tap it.</Body>
      {' Every drink credited to you is on your page, from every bar.'}
    </Body>
  );
}

const styles = StyleSheet.create({
  strong: { fontFamily: fontFamilies.bodySemiBold },
  card: { gap: space.xs, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
});
