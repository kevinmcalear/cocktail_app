import assert from 'node:assert/strict';

import { canMakeLine, glassPlural, kitCheck, methodTools, nearestGlass } from './kitCheck';

assert.deepEqual(methodTools(['Shake', 'Dry shake']), ['shaker', 'strainers']);
assert.deepEqual(methodTools(['Build']), []);

const kit = {
  glasses: [{ id: 'r', glass: 'rocks' as const, name: 'Rocks 300 ml', model_id: null }, { id: 'h', glass: 'highball' as const, name: null, model_id: null }],
  ice: [
    { id: 'clear', name: 'Clear cube · 50 mm', shape: 'large', draw_as: null, source: 'made' },
    { id: 'block', name: 'Block', shape: 'block', draw_as: null, source: 'made' },
    { id: 'cubes', name: 'Cubes', shape: 'cubes', draw_as: null, source: 'machine' },
  ],
  tools: ['mixing-glass', 'strainers', 'ice-tools'],
  // The clear cube is cut from the block with a bandsaw; the block is frozen in a cooler; the block starts from the cube (a loop the check must survive).
  recipes: new Map([
    ['clear', { tools: ['bandsaw', 'ice-tools'], from: 'block' }],
    ['block', { tools: ['ice-cooler'], from: 'clear' }],
  ]),
};

// An Old Fashioned (Japanese style): rocks and stirred are the venue's; the sphere isn't, the clear cube is nearest.
const ofj = kitCheck({ glass: 'Rocks', ice: ['Sphere'], methods: ['Stir'] }, kit);
assert.deepEqual(ofj.glass, { name: 'Rocks', glass: 'rocks', ok: true, yours: 'Rocks 300 ml' });
assert.deepEqual(ofj.ice, [{ name: 'Sphere', kind: 'sphere', ok: false, yours: null, nearest: 'Clear cube · 50 mm', missing: [] }]);
assert.deepEqual(ofj.tools, { needed: ['mixing-glass', 'strainers'], missing: [] });
assert.equal(ofj.needs, 'Needs a sphere');

// Over the clear cube: its recipe's tools, followed back through the block, are checked too.
const of = kitCheck({ glass: 'Rocks', ice: ['Large cube'], methods: ['Stir'] }, kit);
assert.equal(of.ice[0].yours, 'Clear cube · 50 mm');
assert.equal(of.ready, false);
assert.match(of.needs ?? '', /^Needs /);

// A coupe the venue doesn't list, shaken without tins; cubes from the machine need nothing.
const aviation = kitCheck({ glass: 'Coupe', ice: ['Cubes'], methods: ['Shake'] }, kit);
assert.equal(aviation.glass?.ok, false);
assert.equal(aviation.ice[0].ok, true);
assert.deepEqual(aviation.tools?.missing, ['shaker']);
assert.equal(aviation.needs, 'Needs a coupe and shaker tins');
assert.equal(kitCheck({ glass: null, ice: [], methods: ['Shake'] }, { ...kit, tools: ['jigger'] }).needs, 'Needs shaker tins and hawthorne and julep strainers');

// Nothing listed is nothing checked; a glass the drawings don't know isn't checked.
// A made ice's recipe tools aren't checked against a Kit with no tools.
assert.deepEqual(kitCheck({ glass: 'Rocks', ice: ['Large cube'], methods: [] }, { ...kit, tools: [] }).ice[0].missing, []);
const empty = kitCheck({ glass: 'Coupe', ice: ['Sphere'], methods: ['Shake'] }, { glasses: [], ice: [], tools: [], recipes: new Map() });
assert.deepEqual([empty.glass, empty.ice, empty.tools, empty.ready], [null, [], null, true]);
assert.equal(kitCheck({ glass: 'Custom', ice: [], methods: [] }, kit).glass, null);

// A stored kind beats the name: "Custom" kept as a rocks glass is the venue's rocks; "Hosh" kept as a sphere needs a sphere.
const kinded = kitCheck({ glass: 'Custom', glassKind: 'rocks', ice: [{ name: 'Hosh', kind: 'sphere' }], methods: [] }, kit);
assert.deepEqual(kinded.glass, { name: 'Custom', glass: 'rocks', ok: true, yours: 'Rocks 300 ml' });
assert.deepEqual(kinded.ice.map((i) => [i.name, i.kind, i.ok]), [['Hosh', 'sphere', false]]);
assert.equal(kitCheck({ glass: 'Custom', ice: ['Hosh'], methods: [] }, kit).ice[0].kind, 'cubes', 'not sure reads the name');

// Can we make it (Kept-kit): the board's Aperol Spritz at a bar with no wine glasses.
const spritz = kitCheck({ glass: 'Wine glass', ice: ['Cubes'], methods: [] }, { ...kit, glasses: [...kit.glasses, { id: 'g9', glass: 'collins', name: null, model_id: null }] });
assert.equal(spritz.glass?.ok, false);
assert.deepEqual(spritz.others, []);
assert.equal(canMakeLine(spritz, ['Aperol', 'prosecco'], []), "You have the Aperol and prosecco. It's served in a wine glass, and you have none.");
assert.equal(nearestGlass('wine', { glasses: [{ id: 'g9', glass: 'collins', name: null, model_id: null }] }), 'Collins');
assert.equal(nearestGlass('wine', { glasses: [] }), null);
assert.equal(glassPlural('wine'), 'wine glasses');
assert.equal(glassPlural('coupe'), 'coupes');
assert.equal(canMakeLine(aviation, [], ['Crème de violette']), "You don't have the Crème de violette. It's served in a coupe, and you have none. It also needs shaker tins.");
assert.equal(canMakeLine(kitCheck({ glass: null, ice: [], methods: [] }, kit), ['Gin'], []), 'You have the Gin.');
assert.equal(canMakeLine(kitCheck({ glass: null, ice: [], methods: [] }, kit), [], []), 'You have what it needs.');
