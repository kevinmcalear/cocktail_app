import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useBarInvites } from '@/hooks/useBarInvites';
import { useVenueClaim } from '@/hooks/useVenueSetup';
import { onItsWay } from '@/lib/venueSetup';
import { useVenueSetup } from '@/store/useVenueSetup';

/** "Setup: 3 things on their way · See": Tonight's banner until venue setup is finished (b03). */
export function SetupBanner({ count, onPress }: { count: number; onPress?: () => void }) {
  const ds = useDs();
  const what = count === 0 ? 'pick up where you left off' : `${count} ${count === 1 ? 'thing' : 'things'} on ${count === 1 ? 'its' : 'their'} way`;
  const body = (
    <>
      <IconSymbol name="sparkles" size={16} color={ds.accentText} />
      <Body style={styles.flex} numberOfLines={1}>
        <Body style={styles.strong}>Setup:</Body>
        {` ${what}`}
      </Body>
      <Caption style={[styles.strong, { color: ds.accentText }]}>See</Caption>
    </>
  );
  const style = [styles.banner, { backgroundColor: ds.c.raised }];
  if (!onPress) return <View role="img" aria-label={`The banner Tonight shows until setup is finished: Setup, ${what}`} style={style}>{body}</View>;
  return (
    <PressableScale role="button" accessibilityLabel={`Setup: ${what}. See`} onPress={onPress} style={style}>
      {body}
    </PressableScale>
  );
}

/** Tonight's banner for a venue whose setup on this device isn't finished; opens setup where it left off. */
export function TonightSetupBanner({ barId }: { barId: string }) {
  const router = useRouter();
  const run = useVenueSetup((s) => s.runs[barId]);
  const open = !!run && !run.finished;
  const claim = useVenueClaim(open ? barId : null).data;
  const invites = useBarInvites(barId, open).data ?? [];
  if (!open) return null;
  const count = onItsWay({ claim: claim?.status === 'pending' ? 'pending' : 'none', invites: invites.length, waitingFiles: 0 });
  return <SetupBanner count={count} onPress={() => router.push(`/venue-setup?bar=${barId}` as Href)} />;
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget, paddingHorizontal: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
  flex: { flex: 1, minWidth: 0 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
});
