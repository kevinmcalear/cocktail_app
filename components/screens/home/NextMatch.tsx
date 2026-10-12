import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, RowScore, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import type { DiscoverDrink } from '@/lib/discoverDrinks';
import { formatScore } from '@/lib/ranking';

/**
 * The next match at a tapped bar, peeking under the one shown, with the page
 * dots (disc-search-pin): tap it to page on. `page` is the one showing.
 */
export function NextMatch({ drink, score, count, page, onNext }: { drink: DiscoverDrink; score?: number; count: number; page: number; onNext: () => void }) {
  const ds = useDs();
  return (
    <View style={styles.wrap}>
      <PressableScale
        role="button"
        accessibilityLabel={`Next: ${[drink.name, drink.why, score !== undefined ? formatScore(score) : null].filter(Boolean).join(', ')}`}
        onPress={onNext}
        style={[styles.card, { backgroundColor: ds.c.raised, borderColor: ds.c.line }]}
      >
        <View style={styles.flex}>
          <Body numberOfLines={1}>{drink.name}</Body>
          {drink.why ? (
            <Caption tone="muted" numberOfLines={1}>
              {drink.why}
            </Caption>
          ) : null}
        </View>
        <RowScore score={score} />
      </PressableScale>
      <View aria-hidden style={styles.dots}>
        {Array.from({ length: Math.min(count, 8) }, (_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i === page ? ds.c.ink : ds.c.lineStrong }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.xs },
  dot: { width: 6, height: 6, borderRadius: radius.pill },
});
