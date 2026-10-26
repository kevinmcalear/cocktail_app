import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { layout, radius, space } from '@/constants/tokens';
import { SKETCH, SKETCH_TINT_FAMILIES, SKETCH_TINTS } from '@/constants/sketch';
import { nearestTint, tintName } from '@/lib/sketch/tintName';
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
  /** The picked colour ('#rrggbb'), or null for Auto. */
  value: string | null;
  /** Without it the rows are just a picture of the colours. */
  onChange?: (tint: string | null) => void;
  /** The drink drawn in the pick beside its name; off where it's already drawn (the desktop drink card). */
  frame?: boolean;
  /** The drink's photo and its colours (lib/photoColours.ts): a From your photo row comes first. */
  photo?: { uri: string; colours: readonly string[] } | null;
}

// A swatch shows the colour as the drawing paints it: muted a little by the graphite.
const painted = (hex: string) => mixHex(hex, SKETCH.mute, 0.22);
const byKey = new Map<string, (typeof SKETCH_TINTS)[number]>(SKETCH_TINTS.map((t) => [t.key, t]));

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
 * The drink's sketch colour: Auto (worked out from its spec), one of its
 * photo's colours, or a house watercolour in rows by family (board
 * w2-wizard-finish, E27), with the drink drawn in the one picked. The drink
 * editor's "Sketch colour", the add wizard's, and the gallery's.
 */
export function SketchTintPicker({ inputs, seed, value, onChange, frame = true, photo }: SketchTintPickerProps) {
  const ds = useDs();
  // One object per pick, so each is painted once (SketchDrawing caches by inputs).
  const shown = useMemo(() => withTint(inputs, value), [inputs, value]);
  const pick = onChange ? (hex: string | null) => () => onChange(hex) : () => undefined;
  const auto = <Swatch label="Auto, from the spec" color={null} selected={!value} onPress={onChange ? pick(null) : undefined} />;
  return (
    <View style={styles.stack}>
      <View style={styles.head}>
        {frame ? (
          <View style={[styles.frame, { backgroundColor: ds.c.paper }]} aria-hidden>
            <SketchDrawing inputs={shown} seed={seed} />
          </View>
        ) : null}
        <View style={styles.flex}>
          <Body>{tintName(value)}</Body>
          <Caption tone="muted">{value ? 'Picked for this drink.' : 'From the spec.'}</Caption>
        </View>
      </View>
      <View role={onChange ? 'radiogroup' : undefined} accessibilityLabel="Sketch colour" style={styles.stack}>
        {photo?.colours.length ? (
          <View style={[styles.photoBox, { borderColor: ds.c.line }]}>
            <Caption tone="muted" style={styles.eyebrow}>FROM YOUR PHOTO</Caption>
            <View style={styles.row}>
              <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" accessibilityLabel="Your photo" />
              {auto}
              {photo.colours.map((hex) => (
                <Swatch key={hex} label={`${nearestTint(hex).label} from the photo`} color={painted(hex)} selected={value === hex} onPress={onChange ? pick(hex) : undefined} />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.row}>{auto}</View>
        )}
        {SKETCH_TINT_FAMILIES.map((f) => (
          <View key={f.label}>
            <Caption tone="muted" style={styles.eyebrow}>{f.label.toUpperCase()}</Caption>
            <View style={styles.row}>
              {f.keys.map((key) => {
                const t = byKey.get(key)!;
                return <Swatch key={key} label={t.label} color={painted(t.hex)} selected={value === t.hex} onPress={onChange ? pick(t.hex) : undefined} />;
              })}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const DOT = 32;

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, gap: 2 },
  frame: { width: 84, aspectRatio: 1, borderRadius: radius.control, overflow: 'hidden', borderCurve: 'continuous' },
  photoBox: { gap: space.xs, padding: space.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card, borderCurve: 'continuous' },
  eyebrow: { letterSpacing: 0.6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  thumb: { width: 40, height: 40, borderRadius: radius.control, marginRight: space.xs },
  swatch: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  ring: { padding: 2, borderWidth: 2, borderRadius: radius.pill },
  dot: { width: DOT, height: DOT, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});
