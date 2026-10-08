import { useState } from 'react';
import { View } from 'react-native';

import { SKETCH_SAMPLES } from '@/constants/sketch';
import { GLASS_VARIANTS } from '@/lib/sketch/geometry';
import type { SketchGlass, SketchInputs } from '@/lib/sketch/types';

import { GlassVariantPicker } from '../GlassVariantPicker';
import { Caption } from '../Text';

const from: SketchInputs['from'] = { glass: 'rules', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'rules' };
const drink = (glass: SketchGlass, more: Partial<SketchInputs>): SketchInputs => ({
  v: 2, glass, ice: 'none', method: 'stir', liquid: { hex: SKETCH_SAMPLES.martini, alpha: 0.2 }, foam: null, float: null, bleed: null,
  fizz: false, garnish: null, from, coverage: 1, variant: null, ...more,
});

// A classic in each glass, drawn the way a drink with no photo is.
const SAMPLES: Record<string, { name: string; inputs: SketchInputs }> = {
  martini: { name: 'Martini', inputs: drink('martini', { garnish: 'olive' }) },
  coupe: { name: 'Daiquiri', inputs: drink('coupe', { method: 'shake', liquid: { hex: SKETCH_SAMPLES.daiquiri, alpha: 0.45 }, foam: 'sheen', garnish: 'lime_wheel' }) },
  nick: { name: 'Manhattan', inputs: drink('nick', { liquid: { hex: SKETCH_SAMPLES.manhattan, alpha: 0.9 }, garnish: 'cherry' }) },
  rocks: { name: 'Negroni', inputs: drink('rocks', { ice: 'large', liquid: { hex: SKETCH_SAMPLES.negroni, alpha: 0.95 }, garnish: 'orange_peel' }) },
  highball: { name: 'Gin and tonic', inputs: drink('highball', { ice: 'cubes', method: 'build', fizz: true, garnish: 'lime_wedge' }) },
  collins: { name: 'Tom Collins', inputs: drink('collins', { ice: 'cubes', method: 'build', fizz: true, garnish: 'lemon_wheel' }) },
  wine: { name: 'Red wine', inputs: drink('wine', { liquid: { hex: SKETCH_SAMPLES.redWine, alpha: 0.9 } }) },
  flute: { name: 'French 75', inputs: drink('flute', { liquid: { hex: SKETCH_SAMPLES.champagne, alpha: 0.35 }, fizz: true, garnish: 'lemon_peel' }) },
  spritz: { name: 'Aperol spritz', inputs: drink('spritz', { ice: 'cubes', method: 'build', liquid: { hex: SKETCH_SAMPLES.spritz, alpha: 0.6 }, fizz: true, garnish: 'orange_wheel' }) },
  snifter: { name: 'Cognac', inputs: drink('snifter', { liquid: { hex: SKETCH_SAMPLES.brandy, alpha: 0.85 } }) },
  beer: { name: 'Lager', inputs: drink('beer', { method: 'build', liquid: { hex: SKETCH_SAMPLES.lager, alpha: 0.75 }, foam: 'cap', fizz: true }) },
  mug: { name: 'Irish coffee', inputs: drink('mug', { method: 'build', liquid: { hex: SKETCH_SAMPLES.irishCoffee, alpha: 0.95 }, float: '#f4eedd' }) },
};

/** Every glass that has variants, drawn side by side; tap one to see it chosen. */
export function GlassVariants() {
  const [chosen, setChosen] = useState<Record<string, string>>({});
  return (
    <>
      {(Object.keys(GLASS_VARIANTS) as SketchGlass[]).map((glass) => {
        const sample = SAMPLES[glass];
        if (!sample) return null;
        return (
          <View key={glass}>
            <Caption tone="muted">{sample.name}</Caption>
            <GlassVariantPicker
              glass={glass}
              inputs={sample.inputs}
              seed={`gallery-${glass}`}
              value={chosen[glass] ?? null}
              onChange={(key) => setChosen((c) => ({ ...c, [glass]: key }))}
              notes={glass === 'martini' ? { martini_pony: 'Little Rye uses this' } : undefined}
              accessibilityLabel={`${sample.name} glass`}
            />
          </View>
        );
      })}
    </>
  );
}
