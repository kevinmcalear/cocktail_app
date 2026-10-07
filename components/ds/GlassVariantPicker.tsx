import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, space } from '@/constants/tokens';
import { variantsOf, type GlassVariant } from '@/lib/sketch/geometry';
import type { SketchGlass, SketchInputs } from '@/lib/sketch/types';

import { PressableScale } from './PressableScale';
import { SketchDrawing } from './SketchDrawing';
import { Caption } from './Text';
import { useDs } from './theme';

interface GlassVariantPickerProps {
  glass: SketchGlass;
  /** The drink drawn in each glass. Its own glass and variant are ignored. */
  inputs: SketchInputs;
  /** The drink's id, so each tile is drawn in its hand. */
  seed: string;
  /** The chosen variant's key; null (or another glass's key) is the default. */
  value: string | null;
  /** Without it the row is just a picture of the variants. */
  onChange?: (key: string) => void;
  accessibilityLabel: string;
}

function Tile({ variant, inputs, seed, selected, onChange }: { variant: GlassVariant; inputs: SketchInputs; seed: string; selected: boolean; onChange?: (key: string) => void }) {
  const ds = useDs();
  const drawn = useMemo(() => ({ ...inputs, variant: variant.key }), [inputs, variant.key]);
  // The ring sits a gap outside the paper, so it reads on light and dark grounds alike.
  const body = (
    <>
      <View style={[styles.ring, { borderColor: selected ? ds.c.ink : 'transparent' }]}>
        <View style={[styles.frame, { backgroundColor: ds.c.paper }]}>
          <SketchDrawing inputs={drawn} seed={seed} />
        </View>
      </View>
      <Caption tone={selected ? undefined : 'muted'}>{variant.label}</Caption>
    </>
  );
  if (!onChange) return <View style={styles.tile}>{body}</View>;
  return (
    <PressableScale role="radio" aria-checked={selected} accessibilityLabel={variant.label} onPress={() => onChange(variant.key)} style={styles.tile}>
      {body}
    </PressableScale>
  );
}

/**
 * The ways a glass can be drawn, side by side, as a row of radio tiles: the
 * drink editor's "Glass drawing", and the gallery's glassware section.
 */
export function GlassVariantPicker({ glass, inputs, seed, value, onChange, accessibilityLabel }: GlassVariantPickerProps) {
  const list = variantsOf(glass);
  const chosen = list.find((x) => x.key === value)?.key ?? list[0].key;
  const base = useMemo(() => ({ ...inputs, glass }), [inputs, glass]);
  return (
    <View role={onChange ? 'radiogroup' : undefined} accessibilityLabel={accessibilityLabel} style={styles.row}>
      {list.map((x) => (
        <Tile key={x.key} variant={x} inputs={base} seed={seed} selected={!!onChange && x.key === chosen} onChange={onChange} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, maxWidth: 140, gap: space.xs, alignItems: 'center' },
  ring: { width: '100%', padding: 2, borderWidth: 2, borderRadius: radius.control + 4, borderCurve: 'continuous' },
  frame: { width: '100%', aspectRatio: 1, borderRadius: radius.control, overflow: 'hidden', borderCurve: 'continuous' },
});
