import assert from 'node:assert/strict';

import { kitCheck, methodTools } from './kitCheck';

assert.deepEqual(methodTools(['Shake', 'Dry shake']), ['shaker', 'strainers']);
assert.deepEqual(methodTools(['Build']), []);

const kit = {
  glasses: [{ glass: 'rocks' as const, name: 'Rocks 300 ml' }, { glass: 'highball' as const, name: null }],
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

// Nothing listed is nothing checked; a glass the drawings don't know isn't checked.
const empty = kitCheck({ glass: 'Coupe', ice: ['Sphere'], methods: ['Shake'] }, { glasses: [], ice: [], tools: [], recipes: new Map() });
assert.deepEqual([empty.glass, empty.ice, empty.tools, empty.ready], [null, [], null, true]);
assert.equal(kitCheck({ glass: 'Custom', ice: [], methods: [] }, kit).glass, null);
