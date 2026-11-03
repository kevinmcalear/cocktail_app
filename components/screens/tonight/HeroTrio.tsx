import { StyleSheet } from 'react-native';

import { DrinkDrawingFor, PressableScale } from '@/components/ds';
import { DrawingTrio } from '@/components/ds/DrawingTrio';
import { trioLayout } from '@/components/ds/trioPlaces';

// Apart from TonightParts, so the pages that only use its labels and sections don't load the trio.

/** Staff Tonight's hero draws the canvas's trio smaller (Prod-today-staff: 131, 169, 131). */
const HERO = trioLayout(0.82);

/** Three drinks from the list on now, the middle one larger, higher and in front (staff Tonight's hero). */
export function HeroTrio({ ids, label, onPress }: { ids: readonly string[]; label: string; onPress: () => void }) {
  return (
    <PressableScale role="link" accessibilityLabel={label} onPress={onPress} style={styles.trio}>
      <DrawingTrio ids={ids.slice(0, 3)} layout={HERO} draw={(id, size) => <DrinkDrawingFor itemId={id} size={size} />} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // The board's hero block: 196 tall, the trio at its top.
  trio: { height: 196, alignItems: 'center' },
});
