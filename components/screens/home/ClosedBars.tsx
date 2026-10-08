import { StyleSheet, View } from 'react-native';

import { Button, Caption } from '@/components/ds';
import { BarResultRow, ResultGroup } from '@/components/search/ResultRows';
import { space } from '@/constants/tokens';
import type { DiscoverBar } from '@/lib/discoverDrinks';

const barCount = (n: number) => `${n} closed ${n === 1 ? 'bar' : 'bars'}`;

/**
 * Bars that have shut, in the area. Discover is for places to go, so they're
 * left out and only mentioned until "Closed bars" is on in Filters. Then they
 * list here, faded and tagged with when they closed. Search finds them either way.
 */
export function ClosedBars({ bars, shown, where, onShow }: { bars: DiscoverBar[]; shown: boolean; where: string; onShow: (on: boolean) => void }) {
  if (!bars.length) return null;
  if (!shown) {
    return (
      <View style={styles.note}>
        <Caption tone="muted" style={styles.flex}>{`${barCount(bars.length)} ${where} left out, kept for their history.`}</Caption>
        <Button label="Show" variant="ghost" onPress={() => onShow(true)} />
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <ResultGroup label={`Closed bars ${where}`} items={bars} render={(b) => <BarResultRow key={b.id} bar={b} />} />
      <Button label="Hide closed bars" variant="ghost" onPress={() => onShow(false)} style={styles.start} />
    </View>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  section: { gap: space.xs },
  start: { alignSelf: 'flex-start' },
});
