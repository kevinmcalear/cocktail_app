import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Tag, useDs } from '@/components/ds';
import { font, radius, space } from '@/constants/tokens';
import { useVenueClaim, useVenuePage } from '@/hooks/useVenueSetup';
import { withAlpha } from '@/lib/color';

/**
 * Where proving it's yours stands, beside held glassware: waiting, with the
 * claim being checked, or a way to do it now. Nothing once the page is theirs.
 */
export function ClaimNote({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const claim = useVenueClaim(barId);
  const page = useVenuePage(barId);
  if (!claim.isSuccess || !page.isSuccess || page.data || claim.data?.status === 'approved') return null;
  const waiting = claim.data?.status === 'pending';
  return (
    <View style={[styles.claim, { backgroundColor: ds.c.raised }]}>
      <View style={styles.claimHead}>
        <Body style={[styles.strong, styles.flex]}>Proving it’s yours</Body>
        {waiting ? <Tag label="Waiting" /> : null}
      </View>
      <Caption tone="muted">{waiting ? 'We’re checking it’s yours. Everything here works while you wait.' : 'Your page stays private until we’ve checked it’s yours. Everything here works meanwhile.'}</Caption>
      {waiting ? null : <Button label="Prove it’s yours" variant="secondary" dense onPress={() => router.push(`/venue-setup?bar=${barId}&step=claim` as Href)} style={styles.start} />}
    </View>
  );
}

/** Over How it looks when Your team opens it first (invite-team-last, step 2): why the look comes before the invites. */
export function LookFirstNote() {
  const ds = useDs();
  return (
    <View style={[styles.lookFirst, { backgroundColor: withAlpha(ds.accentFill.fill, 0.14) }]}>
      <Body>Your team’s invite wears this: the logo, colour and font go into every email.</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  strong: { ...font.semiBold },
  flex: { flex: 1, minWidth: 0 },
  claim: { gap: space.xs, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
  claimHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  start: { alignSelf: 'flex-start', marginTop: space.xs },
  lookFirst: { padding: space.md, borderRadius: radius.control, borderCurve: 'continuous' },
});
