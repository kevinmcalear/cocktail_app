// The garnish belongs to its own stage and nothing else: no part the drawing
// shows before the garnish lands (its stages, their night painting, the pencil
// alone, night's glow) carries any of it (Kevin, #1155: the garnish faded in
// with the liquid, through the glow). Run: npm run test:unit
import assert from 'node:assert/strict';

import { paintSketch } from './paint';
import { glowParts, nightScene, onlyStages, pencilOnly } from './passes';
import type { Scene, SceneEl, StageName } from './scene';
import { readSketchInputs, SKETCH_GARNISHES, type SketchGarnish, type SketchInputs } from './types';

/** Each stage's leaves, by stage, in paint order (a stage opened twice is two entries). */
const stagesOf = (scene: Scene) =>
  scene.els.flatMap((el) => {
    if (el.k !== 'stage') return [];
    const out: SceneEl[] = [];
    const walk = (els: SceneEl[]) => els.forEach((c) => (c.k === 'group' || c.k === 'stage' ? walk(c.children) : out.push(c)));
    walk(el.children);
    return [{ name: el.name, leaves: out }];
  });
const colours = (els: SceneEl[]) => [...new Set(els.map((el) => ('color' in el ? el.color : '')))].sort();
/** Painted before the garnish, so the same with or without one. */
const BEFORE: readonly StageName[] = ['search', 'liquid', 'foam', 'ice', 'fizz'];

const drinks: Record<string, unknown>[] = [
  { glass: 'rocks', ice: 'large', liquid: { hex: '#9f363b', alpha: 0.95 } },
  { glass: 'martini', ice: 'none', liquid: { hex: '#e8e4c9', alpha: 0.15 } },
  { glass: 'coupe', ice: 'none', foam: 'silk', liquid: { hex: '#caa26b', alpha: 0.7 } },
  { glass: 'highball', ice: 'cubes', fizz: true, liquid: { hex: '#d9c56a', alpha: 0.5 } },
  { glass: 'collins', ice: 'crushed', liquid: { hex: '#7fa34d', alpha: 0.6 } },
];
const read = (d: Record<string, unknown>, garnish: SketchGarnish | null): SketchInputs => {
  const out = readSketchInputs({ v: 2, method: 'stir', ...d, garnish });
  assert.ok(out, `reads ${JSON.stringify(d)}`);
  return out;
};

let compared = 0;
for (const d of drinks) {
  for (const detail of ['full', 'thumb'] as const) {
    for (const bands of [false, true]) {
      const paint = (garnish: SketchGarnish | null) => paintSketch(read(d, garnish), { seed: `garnish-${d.glass}`, detail, bands });
      const plain = paint(null);
      const night = (s: Scene) => nightScene(s, read(d, null).liquid.hex);
      // Each way the drawing is shown: by day, painted for night, and the pencil alone.
      const looks = [(s: Scene) => s, night, pencilOnly];
      for (const garnish of SKETCH_GARNISHES) {
        const dressed = paint(garnish);
        const where = `${garnish} on a ${d.glass} (${detail}${bands ? ', banded' : ''})`;
        assert.ok(stagesOf(dressed).some((s) => s.name === 'garnish' && s.leaves.length), `${where}: the garnish is drawn in its own stage`);
        for (const look of looks) {
          const [a, b] = [stagesOf(look(plain)), stagesOf(look(dressed))];
          const pick = (st: typeof a, names: readonly StageName[]) => st.filter((s) => names.includes(s.name));
          // The stages painted before it: exactly what the drink has without it.
          assert.deepEqual(pick(b, BEFORE), pick(a, BEFORE), `${where}: no garnish in a stage before it`);
          // The glass's pencil is painted after it (on its own hand's wobble), so compare what it's drawn in: no garnish colour.
          assert.deepEqual(colours(pick(b, ['glass']).flatMap((s) => s.leaves)), colours(pick(a, ['glass']).flatMap((s) => s.leaves)), `${where}: no garnish in the glass's pencil`);
          compared++;
        }
        // Night's glow, part by part: each part holds only its own stage, and the drink's glow is the same without a garnish.
        // (AnimatedSketch brings each part in with its own stage.)
        const parts = glowParts(night(dressed));
        assert.deepEqual(parts.map((p) => p.stage), ['liquid', 'garnish'], `${where}: the drink and the garnish glow apart`);
        for (const { stage, scene } of parts) {
          assert.ok(stagesOf(scene).every((s) => s.name === stage), `${where}: the ${stage} glow holds only the ${stage}`);
          if (stage !== 'garnish') assert.deepEqual(scene, onlyStages(night(plain), [stage]), `${where}: no garnish in the ${stage} glow`);
        }
      }
    }
  }
}

console.log(`garnish stage: only in its own stage (${compared} comparisons)`);
