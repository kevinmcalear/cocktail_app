import { StyleSheet, View } from 'react-native';

import { radius, space } from '@/constants/tokens';

import { SKETCH_SAMPLES } from '@/constants/sketch';
import type { IceLook, SketchGlass, SketchInputs } from '@/lib/sketch/types';

import { SketchDrawing } from '../SketchDrawing';
import { Caption } from '../Text';

const from: SketchInputs['from'] = { glass: 'data', ice: 'data', method: 'rules', liquid: 'rules', garnish: 'rules' };
const drink = (glass: SketchGlass, more: Partial<SketchInputs>): SketchInputs => ({
  v: 2, glass, ice: 'none', method: 'stir', liquid: { hex: SKETCH_SAMPLES.lager, alpha: 0.55 }, foam: null, float: null, bleed: null,
  fizz: false, garnish: null, from, coverage: 1, variant: null, ...more,
});
const highball = (more: Partial<SketchInputs>) => drink('highball', { method: 'build', liquid: { hex: SKETCH_SAMPLES.champagne, alpha: 0.45 }, ...more });
const clear: IceLook = { clear: true };

// The Kit and ice board's step 10 (whole-app canvas, venue-ice-made-your-way-2), drawn by the painter.
const SAMPLES: { key: string; title: string; note: string; inputs: SketchInputs }[] = [
  { key: 'machine', title: 'Cubes, from the machine', note: 'cloudy, 22 mm', inputs: drink('rocks', { ice: 'cubes', iceLook: { mm: 22, clear: false } }) },
  { key: 'clear', title: 'Clear cube, 50 mm', note: 'to scale in an 85 mm rocks glass', inputs: drink('rocks', { ice: 'large', iceLook: { mm: 50, ...clear } }) },
  { key: 'stamp', title: 'Stamped', note: 'the mark on the top face', inputs: drink('rocks', { ice: 'large', iceLook: { mm: 50, ...clear, stamp: true } }) },
  { key: 'inside', title: 'Prism inside', note: 'what is frozen in', inputs: drink('rocks', { ice: 'large', iceLook: { mm: 50, ...clear, inside: true } }) },
  { key: 'sphere', title: 'Sphere, 60 mm', note: 'pressed, clear', inputs: drink('rocks', { ice: 'sphere', iceLook: { mm: 60, ...clear } }) },
  { key: 'spear', title: 'Spear, 133 mm', note: 'its length against the glass', inputs: highball({ ice: 'spear', iceLook: { mm: 32, lengthMm: 133, ...clear } }) },
  {
    key: 'stack', title: 'Collins block on small cubes', note: 'the joins fade in the drink',
    inputs: highball({ ice: 'spear', build: [{ kind: 'cubes', n: 2, mm: 32, ...clear }, { kind: 'spear', mm: 32, lengthMm: 120, ...clear }] }),
  },
  { key: 'today', title: 'The same build, no look', note: 'as every drink draws today', inputs: highball({ ice: 'spear', build: [{ kind: 'cubes', n: 2 }, { kind: 'spear' }] }) },
  { key: 'crushed', title: 'Crushed, mounded', note: 'from the Lewis bag', inputs: drink('rocks', { ice: 'crushed', build: [{ kind: 'crushed', to: 'mound' }] }) },
];

/** Ice drawn as the venue makes it: size to scale, clear or cloudy, stamped, something frozen inside, a block on small pieces. */
export function IceLooks() {
  return (
    <View style={styles.wrap}>
      {SAMPLES.map((s) => (
        <View key={s.key} style={styles.tile}>
          <View style={styles.square}>
            <SketchDrawing inputs={s.inputs} seed={`gallery-ice-${s.key}`} />
          </View>
          <Caption numberOfLines={2}>{s.title}</Caption>
          <Caption tone="muted" numberOfLines={2}>{s.note}</Caption>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: { width: 150, gap: space.xs },
  square: { width: 150, height: 150, borderRadius: radius.control, borderCurve: 'continuous', overflow: 'hidden' },
});
