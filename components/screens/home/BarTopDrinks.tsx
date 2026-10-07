import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, Spec } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useBarTopDrinks } from '@/hooks/useRankings';
import { splitTopDrinks, topDrinkHref, topDrinkLabel } from '@/lib/barTopDrinks';
import { formatScore } from '@/lib/ranking';

/** How many a bar card shows. */
const TOP = 3;

/**
 * "Top drinks here" on the map's bar card, under its name and above the
 * drinks matching Discover's search: the bar's three best-scored drinks,
 * each opening the drink. Nothing until a drink has a score, so an early
 * bar's card stays as it was.
 */
export function BarTopDrinks({ barId }: { barId: string }) {
  const router = useRouter();
  const { data } = useBarTopDrinks(barId, TOP);
  const top = splitTopDrinks(data ?? []).scored;
  if (!top.length) return null;
  return (
    <View style={styles.block}>
      <Caption tone="muted" style={styles.cap}>
        Top drinks here
      </Caption>
      <View role="list">
        {top.map((d) => (
          <PressableScale
            key={d.item_id}
            role="link"
            accessibilityLabel={`${topDrinkLabel(d)}. Open`}
            onPress={() => router.push(topDrinkHref(d) as Href)}
            style={styles.row}
          >
            <Spec tone="muted" style={styles.position}>
              {d.position}
            </Spec>
            <Body numberOfLines={1} style={styles.name}>
              {d.name}
            </Body>
            <Spec>{formatScore(d.score!)}</Spec>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.xs },
  cap: { letterSpacing: 1.2, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  position: { minWidth: space.lg },
  name: { flex: 1, minWidth: 0 },
});
