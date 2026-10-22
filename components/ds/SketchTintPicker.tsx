import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { layout, radius, space } from '@/constants/tokens';
import { SKETCH, SKETCH_TINTS } from '@/constants/sketch';
import { mixHex } from '@/lib/sketch/random';
import { withTint, type SketchInputs } from '@/lib/sketch/types';

import { PressableScale } from './PressableScale';
import { SketchDrawing } from './SketchDrawing';
import { Body, Caption } from './Text';
import { useDs } from './theme';

interface SketchTintPickerProps {
  /** The drink's drawing. Its own tint is ignored: value is what's shown. */
  inputs: SketchInputs;
  /** The drink's id, so the preview is drawn in its hand. */
  seed: string;
  /** The picked colour ('#rrggbb', a SKETCH_TINTS hex), or null for Auto. */
  value: string | null;
  /** Without it the row is just a picture of the colours. */
  onChange?: (tint: string | null) => void;
  /** The drink drawn in the pick beside the swatches; off where it's already drawn (the desktop drink card). */
  frame?: boolean;
}

// A swatch shows the colour as the drawing paints it: muted a little by the graphite.
const painted = (hex: string) => mixHex(hex, SKETCH.mute, 0.22);

function Swatch({ label, color, selected, onPress }: { label: string; color: string | null; selected: boolean; onPress?: () => void }) {
  const ds = useDs();
  const dot = (
    <View style={[styles.ring, { borderColor: selected ? ds.c.ink : 'transparent' }]}>
      <View style={[styles.dot, { backgroundColor: color ?? ds.c.paper, borderColor: ds.c.lineStrong }]}>
        {color ? null : <Caption color={SKETCH.graphite}>A</Caption>}
      </View>
    </View>
  );
  if (!onPress) return <View style={styles.swatch}>{dot}</View>;
  return (
    <PressableScale role="radio" aria-checked={selected} accessibilityLabel={label} onPress={onPress} style={styles.swatch}>
      {dot}
    </PressableScale>
  );
}

/**
 * The drink's sketch colour: Auto (worked out from its spec) or one of the
 * house watercolours, with the drink drawn in the one picked. The drink
 * editor's "Sketch colour", and the gallery's.
 */
export function SketchTintPicker({ inputs, seed, value, onChange, frame = true }: SketchTintPickerProps) {
  const ds = useDs();
  const tint = SKETCH_TINTS.find((t) => t.hex === value) ?? null;
  // One object per pick, so each is painted once (SketchDrawing caches by inputs).
  const shown = useMemo(() => withTint(inputs, tint?.hex ?? null), [inputs, tint]);
  const pick = onChange ? (hex: string | null) => () => onChange(hex) : () => undefined;
  return (
    <View style={styles.wrap}>
      {frame ? (
        <View style={[styles.frame, { backgroundColor: ds.c.paper }]} aria-hidden>
          <SketchDrawing inputs={shown} seed={seed} />
        </View>
      ) : null}
      <View style={styles.side}>
        <Body>{tint ? tint.label : 'Auto'}</Body>
        <Caption tone="muted">{tint ? 'Picked for this drink.' : 'From the spec.'}</Caption>
        <View role={onChange ? 'radiogroup' : undefined} accessibilityLabel="Sketch colour" style={[styles.grid, frame ? styles.beside : null]}>
          <Swatch label="Auto, from the spec" color={null} selected={!tint} onPress={onChange ? pick(null) : undefined} />
          {SKETCH_TINTS.map((t) => (
            <Swatch key={t.key} label={t.label} color={painted(t.hex)} selected={tint?.key === t.key} onPress={onChange ? pick(t.hex) : undefined} />
          ))}
        </View>
      </View>
    </View>
  );
}

const DOT = 32;

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, alignItems: 'flex-start' },
  frame: { width: 132, aspectRatio: 1, borderRadius: radius.control, overflow: 'hidden', borderCurve: 'continuous' },
  side: { flex: 1, minWidth: 200, gap: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: space.xs },
  // Beside the drawing, six to a row; on their own (the desktop drink card) one row where it fits.
  beside: { maxWidth: layout.minTapTarget * 6 },
  swatch: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  ring: { padding: 2, borderWidth: 2, borderRadius: radius.pill },
  dot: { width: DOT, height: DOT, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});
