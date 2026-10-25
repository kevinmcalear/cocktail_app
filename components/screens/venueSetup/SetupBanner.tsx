import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useBarInvites } from '@/hooks/useBarInvites';
import { useVenueFeature } from '@/hooks/useVenueFeatures';
import { useVenueClaim, useVenuePage } from '@/hooks/useVenueSetup';
import { onItsWay } from '@/lib/venueSetup';
import { useVenueSetup } from '@/store/useVenueSetup';

/**
 * "Setup: 3 things on their way · See": the banner on Tonight (or Library,
 * with Tonight off) until venue setup is finished (b03). Kept private, it stays to offer proving it's yours (prove).
 */
export function SetupBanner({ count, prove, onPress }: { count: number; prove?: boolean; onPress?: () => void }) {
  const ds = useDs();
  const what = prove
    ? 'prove it’s yours when you’re ready'
    : count === 0
      ? 'pick up where you left off'
      : `${count} ${count === 1 ? 'thing' : 'things'} on ${count === 1 ? 'its' : 'their'} way`;
  const body = (
    <>
      <IconSymbol name="clock" size={16} color={ds.c.muted} />
      <Body style={styles.flex} numberOfLines={1}>
        <Body style={styles.strong}>Setup:</Body>
        {` ${what}`}
      </Body>
      <View style={[styles.see, { borderColor: ds.c.lineStrong }]}>
        <Caption style={styles.strong}>See</Caption>
      </View>
    </>
  );
  const style = [styles.banner, { backgroundColor: ds.c.surface, borderColor: ds.c.line }];
  if (!onPress) return <View role="img" aria-label={`The banner shown until setup is finished: Setup, ${what}`} style={style}>{body}</View>;
  return (
    <PressableScale role="button" accessibilityLabel={`Setup: ${what}. See`} onPress={onPress} style={style}>
      {body}
    </PressableScale>
  );
}

/**
 * The Setup banner for a venue set up on this device, on its first tab
 * (Tonight, or Library for the many venues with Tonight off): while setup isn't
 * finished it opens where it left off; finished but kept private (no claim,
 * no page), it opens the claim.
 */
export function TonightSetupBanner({ barId }: { barId: string }) {
  const router = useRouter();
  const run = useVenueSetup((s) => s.runs[barId]);
  const open = !!run && !run.finished;
  // Finished with the claim sent: nothing left to offer, so nothing to look up.
  const proving = !!run?.finished && !run.done.includes('claim');
  const claim = useVenueClaim(open || proving ? barId : null);
  const page = useVenuePage(proving ? barId : null);
  const invites = useBarInvites(barId, open).data ?? [];
  if (!run || (!open && !proving)) return null;
  if (!open) {
    const status = claim.data?.status;
    const unproved = claim.isSuccess && page.isSuccess && !page.data && status !== 'pending' && status !== 'approved';
    return unproved ? <SetupBanner count={0} prove onPress={() => router.push(`/venue-setup?bar=${barId}&step=claim` as Href)} /> : null;
  }
  const count = onItsWay({ claim: claim.data?.status === 'pending' ? 'pending' : 'none', invites: invites.length, waitingFiles: 0 });
  return <SetupBanner count={count} onPress={() => router.push(`/venue-setup?bar=${barId}` as Href)} />;
}

/** The same banner at the top of Library, for a venue with Tonight off (new venues start with it off). */
export function LibrarySetupBanner({ barId }: { barId: string }) {
  return useVenueFeature('tonight') ? null : <TonightSetupBanner barId={barId} />;
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget + space.md, paddingLeft: space.lg, paddingRight: space.sm, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  see: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
});
