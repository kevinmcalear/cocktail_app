import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, PressableScale, useDs } from '@/components/ds';
import { SketchDrawing } from '@/components/ds/SketchDrawing';
import { radius, space } from '@/constants/tokens';
import type { GlassVariant } from '@/lib/sketch/geometry';
import type { SketchInputs } from '@/lib/sketch/types';

interface ShapeTilesProps {
  /** Each tile: a shape's key (GLASS_VARIANTS) and what to call it. */
  shapes: readonly Pick<GlassVariant, 'key' | 'label'>[];
  /** The drink, drawn in each shape. Its own variant is ignored. */
  inputs: SketchInputs;
  /** So each tile is drawn in the drink's hand. */
  seed: string;
  /** The picked shape's key. */
  value: string;
  onChange: (key: string) => void;
}

/** The drink sketched in one shape, cached while the drink is the same. */
function ShapeSketch({ inputs, seed, variant }: { inputs: SketchInputs; seed: string; variant: string }) {
  const drawn = useMemo(() => ({ ...inputs, variant }), [inputs, variant]);
  return <SketchDrawing inputs={drawn} seed={seed} />;
}

/**
 * "Which shape?" (canvas make-create-glass): the drink sketched in each shape
 * (or each of the bar's own glasses), on paper in a card with its name, the
 * picked one ringed in the accent.
 */
export function ShapeTiles({ shapes, inputs, seed, value, onChange }: ShapeTilesProps) {
  const ds = useDs();
  return (
    <View role="radiogroup" accessibilityLabel="Glass shape" style={styles.row}>
      {shapes.map((s) => {
        const on = s.key === value;
        return (
          <PressableScale
            key={s.key}
            role="radio"
            aria-checked={on}
            accessibilityLabel={s.label}
            onPress={() => onChange(s.key)}
            style={[styles.tile, { borderColor: on ? ds.accentText : ds.c.line, backgroundColor: on ? ds.c.raised : ds.c.surface }]}
          >
            <View style={[styles.paper, { backgroundColor: ds.c.paper }]}>
              <ShapeSketch inputs={inputs} seed={seed} variant={s.key} />
            </View>
            <Body align="center">{s.label}</Body>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Three to a row: wine has six shapes, and a phone row of six is too small to tell apart.
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexBasis: '30%', flexGrow: 1, maxWidth: '33.3%', minWidth: 0, alignItems: 'center', gap: space.xs + 2, paddingTop: space.sm + 2, paddingBottom: space.md, paddingHorizontal: space.xs + 2, borderRadius: radius.card, borderWidth: 1.5 },
  paper: { alignSelf: 'stretch', height: 120, borderRadius: radius.control, overflow: 'hidden', borderCurve: 'continuous' },
});
