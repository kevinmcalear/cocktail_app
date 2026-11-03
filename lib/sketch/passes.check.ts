// Checks for lib/sketch/passes.ts: splitting a scene by part, the pencil
// alone, and the night pass. Run: npm run test:unit
import assert from 'node:assert/strict';

import { BARE_GLASS } from './bareGlass';
import { bareGlassSketch } from './draft';
import { paintSketch } from './paint';
import { CHALK, glowScene, hexToLch, lchToHex, nightScene, onlyStages, pencilOnly, withoutStages } from './passes';
import type { Scene, SceneEl } from './scene';
import { isBareGlass, readSketchInputs } from './types';

const leaves = (scene: Scene) => {
  const out: SceneEl[] = [];
  const walk = (els: SceneEl[]) => els.forEach((el) => (el.k === 'group' || el.k === 'stage' ? walk(el.children) : out.push(el)));
  walk(scene.els);
  return out;
};

const negroni = readSketchInputs({ v: 2, glass: 'rocks', ice: 'large', method: 'stir', liquid: { hex: '#9f363b', alpha: 0.95 }, garnish: 'orange_peel' });
assert.ok(negroni);
const scene = paintSketch(negroni, { seed: 'negroni', detail: 'full' });
const all = leaves(scene).length;

// Split by part: the liquid and the rest add back up to the whole.
const liquid = leaves(onlyStages(scene, ['liquid'])).length;
const rest = leaves(withoutStages(scene, ['liquid'])).length;
assert.ok(liquid > 0, 'the drink has a liquid part');
assert.equal(liquid + rest, all);

// The pencil alone is strokes only.
const pencil = leaves(pencilOnly(scene));
assert.ok(pencil.length > 0 && pencil.every((el) => el.k === 'stroke'));

// Night: no dark pencil left (it's chalk), no dark fills, and the drink is still there.
const night = nightScene(scene, negroni.liquid.hex);
for (const el of leaves(night)) {
  if (el.k === 'stroke' || el.k === 'fill') assert.ok(!/^#[0-9a-f]{6}$/i.test(el.color) || el.color === CHALK || hexToLch(el.color).L >= 0.42, `dark ${el.k} left at night: ${el.color}`);
}
assert.ok(leaves(onlyStages(night, ['liquid'])).length > 0, 'the drink survives the night pass');
assert.ok(leaves(glowScene(night)).length > 0, 'the glow has the drink in it');

// A bare glass has only its pencil: at night its chalk is stronger and heavier than a drawn drink's, and light is untouched.
const inkOf = (sc: typeof scene) => leaves(sc).filter((el) => el.k === 'stroke').reduce((sum, el) => sum + (el.k === 'stroke' ? el.o * el.w : 0), 0);
const pencilScene = pencilOnly(scene);
assert.ok(inkOf(nightScene(pencilScene, negroni.liquid.hex, true)) > inkOf(nightScene(pencilScene, negroni.liquid.hex)) * 1.5, 'bare chalk reads stronger');
assert.ok(leaves(nightScene(pencilScene, negroni.liquid.hex, true)).every((el) => el.k !== 'stroke' || el.o <= 1), 'chalk opacity stays within 1');

// What counts as bare: the board's glass and a drafted empty glass, even with a tint; never a drawn drink.
assert.ok(isBareGlass(BARE_GLASS) && isBareGlass(bareGlassSketch('Coupe')) && isBareGlass({ ...bareGlassSketch('Coupe'), tint: '#c8642a' }));
assert.ok(!isBareGlass(negroni), 'a drawn drink is not bare');

// OKLCH round trip.
for (const hex of ['#9f363b', '#caa26b', '#efe9dd', '#000000', '#ffffff']) assert.equal(lchToHex(hexToLch(hex)), hex);

console.log('sketch passes: parts, pencil, night');
