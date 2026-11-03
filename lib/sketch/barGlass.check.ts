import assert from 'node:assert/strict';

import { inBarGlass, inBarGlassCached, type DrawingGlass } from './barGlass';
import type { GlassOutline } from './outline';
import type { SketchInputs } from './types';

// A classic on a bar's menu is drawn in that bar's default glass of its type;
// a drink with its own drawing or traced glass keeps it.

const classic: SketchInputs = {
  v: 2, glass: 'coupe', ice: 'none', method: 'shake', liquid: { hex: '#d2d4ad', alpha: 0.8 }, foam: null, float: null, bleed: null,
  fizz: false, garnish: null, from: { glass: 'rules', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'rules' }, coverage: 1, variant: null,
};
const traced = { height_mm: 140, rim_mm: 100, widest_mm: 100, stemmed: true, outline: [[0, 50], [40, 30], [140, 35]] } as unknown as GlassOutline;
const bar: DrawingGlass[] = [
  { glass: 'coupe', variant: 'coupe_wide', is_default: false, outline: null },
  { glass: 'coupe', variant: 'coupe_deep', is_default: true, outline: null },
  { glass: 'rocks', variant: null, is_default: true, outline: null, model: { outline: traced } },
];

// The bar's default coupe, not the first coupe on its list.
assert.equal(inBarGlass(classic, bar).variant, 'coupe_deep');
// A drink with its own drawing keeps it.
const picked = { ...classic, variant: 'coupe_wide' };
assert.equal(inBarGlass(picked, bar), picked);
// A drink in a traced glass keeps it.
const real = { ...classic, outline: traced };
assert.equal(inBarGlass(real, bar), real);
// A rocks drink takes the bar's traced rocks glass (from its model), no variant.
const rocks = inBarGlass({ ...classic, glass: 'rocks' }, bar);
assert.equal(rocks.outline, traced);
assert.equal(rocks.variant, null);
// No glass of that type at the bar, or no bar: as stored.
const flute = { ...classic, glass: 'flute' as const };
assert.equal(inBarGlass(flute, bar), flute);
assert.equal(inBarGlass(classic, null), classic);
// A variant of another type is never borrowed.
assert.equal(inBarGlass(classic, [{ glass: 'coupe', variant: 'nick_tall', is_default: true, outline: null }]), classic);
// Same drink, same bar: the same object, so its scene paints once.
assert.equal(inBarGlassCached(classic, bar), inBarGlassCached(classic, bar));

console.log('barGlass: ok');
