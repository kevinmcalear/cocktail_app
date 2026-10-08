import { StyleSheet, View } from 'react-native';

import { Body, Caption, Headline, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useFlavorBaseline, useItemFlavor, useMyTaste } from '@/hooks/useFlavor';
import { COLD_START_DRINKS, DIMENSIONS, LABEL, level, matchPercent, matchReasons } from '@/lib/flavor';

// Dimensions below this are left off the bars: "barely" isn't worth a row.
const SHOWN_FROM = 0.15;

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Home mode's flavor block on the drink page: how well it fits your taste and
 * why, then its profile as bars with words (never numbers, which would claim
 * more precision than a profile from the spec has).
 */
export function FlavorSection({ itemId }: { itemId: string }) {
  const ds = useDs();
  const { data: flavor } = useItemFlavor(itemId);
  const { data: me } = useMyTaste();
  const { data: baseline } = useFlavorBaseline();
  if (!flavor) return null;

  const shown = DIMENSIONS.filter((d) => flavor.profile[d] >= SHOWN_FROM).sort((a, b) => flavor.profile[b] - flavor.profile[a]);
  const toGo = me ? COLD_START_DRINKS - me.rankedDrinks : COLD_START_DRINKS;
  const scored = me && me.basis === 'ranked' && toGo <= 0 ? matchPercent(me.taste, flavor.profile) : null;
  const hasTaste = !!me && Object.keys(me.taste).length > 0;

  return (
    <View style={styles.section}>
      <Headline role="heading">Flavor</Headline>
      {scored !== null ? <Headline>{`${scored}% match for you`}</Headline> : null}
      {hasTaste ? <Body>{matchReasons(me!.taste, flavor.profile, me!.basis, baseline)}</Body> : null}
      {toGo > 0 ? (
        <Caption tone="muted">{`Rank ${toGo} more drink${toGo === 1 ? '' : 's'} you've had to see how well this matches your taste.`}</Caption>
      ) : null}
      <View role="list" style={styles.bars}>
        {shown.map((d) => (
          <View key={d} role="listitem" accessible accessibilityLabel={`${capital(LABEL[d])}: ${level(flavor.profile[d])}`} style={styles.row}>
            <Caption style={styles.label}>{capital(LABEL[d])}</Caption>
            <View style={[styles.track, { backgroundColor: ds.c.raised }]}>
              <View style={[styles.fill, { width: `${Math.round(flavor.profile[d] * 100)}%`, backgroundColor: ds.c.muted }]} />
            </View>
            <Caption tone="muted" style={styles.word}>
              {level(flavor.profile[d])}
            </Caption>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  bars: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { width: 64 },
  track: { flex: 1, height: space.sm, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  word: { width: 72 },
});
