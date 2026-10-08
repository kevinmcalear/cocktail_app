import { StyleSheet, View } from 'react-native';

import { Body, Caption, Headline } from '@/components/ds';
import { FlavorBars } from '@/components/screens/taste/FlavorBars';
import { space } from '@/constants/tokens';
import { useFlavorBaseline, useItemFlavor, useMyTaste } from '@/hooks/useFlavor';
import { COLD_START_DRINKS, matchPercent, matchReasons } from '@/lib/flavor';

// Dimensions below this are left off the bars: "barely" isn't worth a row.
const SHOWN_FROM = 0.15;

/**
 * Home mode's flavor block on the drink page: how well it fits your taste and
 * why, then its profile as bars with words (never numbers, which would claim
 * more precision than a profile from the spec has).
 */
export function FlavorSection({ itemId }: { itemId: string }) {
  const { data: flavor } = useItemFlavor(itemId);
  const { data: me } = useMyTaste();
  const { data: baseline } = useFlavorBaseline();
  if (!flavor) return null;

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
      <FlavorBars values={flavor.profile} from={SHOWN_FROM} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
});
