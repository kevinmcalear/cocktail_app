import assert from 'node:assert/strict';

import { GLYPHS, glyphNames } from './glyphs';

// Path data only: commands and numbers, nothing a template slipped in (NaN, undefined).
const PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]*$/;
for (const name of glyphNames) {
  const g = GLYPHS[name];
  assert.ok(g.d || g.f, `${name} draws something`);
  for (const d of [g.d, g.f ?? '']) assert.ok(PATH.test(d) && !/NaN|undefined/.test(d), `${name} is path data: ${d}`);
  if (g.on || g.solid) assert.ok(g.f, `${name} is filled, so it has a fill shape`);
  if (name.endsWith('.fill') && !g.solid) assert.ok(g.on, `${name} is a .fill name, so it is always on`);
}

// Every place lights up when it's the one you're on (nav-icons board).
for (const name of glyphNames.filter((n) => n.startsWith('place.'))) assert.ok(GLYPHS[name].f, `${name} has an on fill`);
assert.ok(GLYPHS['place.tonight'].day, 'Tonight carries the date');
assert.equal(GLYPHS.gearshape.d, GLYPHS['place.settings'].d, 'Settings is the sliders everywhere');
