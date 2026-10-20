import assert from 'node:assert/strict';

import { iceBuildLine, iceTip, quickBuild, readIceBuild, saysMore, toStored, whichQuick, type IceLayer } from './iceBuild';

// --- the drink page's line, bottom to top ---
assert.equal(iceBuildLine([{ ice: 'Cubes', n: 4 }, { ice: 'Pebble', to: 'mound' }]), 'Over 4 cubes, pebble on top, mounded');
assert.equal(iceBuildLine([{ ice: 'Cubes', n: 2 }, { ice: 'Spear', n: 1 }]), 'Over 2 cubes, a spear on top');
assert.equal(iceBuildLine([{ ice: 'Cubes', n: 1 }, { ice: 'Spear' }]), 'Over a cube, a spear on top');
assert.equal(iceBuildLine([{ ice: 'Large cube', n: 1 }, { ice: 'Crushed', to: 'rim', packed: true }]), 'Over a large cube, packed crushed around it');
assert.equal(iceBuildLine([{ ice: 'Crushed', to: 'rim' }, { ice: 'Crushed', to: 'mound' }]), 'Over crushed, topped with more crushed, mounded');
assert.equal(iceBuildLine([{ ice: 'Cubes', tin: true }, { ice: 'Crushed', to: 'mound' }]), 'The shaking ice, dumped in, crushed on top, mounded');
assert.equal(iceBuildLine([{ ice: 'Crushed', to: 'mound', packed: true }]), 'Over packed crushed, mounded');
assert.equal(iceBuildLine([{ ice: 'Pebble', to: 'half' }, { ice: 'Cubes', n: 3 }]), 'Over pebble to half, 3 cubes on top');

// --- what's worth saving ---
assert.equal(saysMore(null), false);
assert.equal(saysMore([{ ice: 'Cubes' }]), false, 'one plain ice is just ice_id');
assert.equal(saysMore([{ ice: 'Crushed', to: 'mound' }]), true);
assert.equal(saysMore([{ ice: 'Cubes' }, { ice: 'Spear' }]), true);

// --- quick builds, and telling them apart again ---
const id = (n: string) => n;
for (const q of ['cubes-pebble', 'spear-cubes', 'crushed-mound', 'dump', 'collar'] as const) assert.equal(whichQuick(quickBuild(q, id, 'Cubes')), q);
assert.equal(whichQuick(quickBuild('dump', id, 'Crushed')), 'dump', 'the tin is the tin, whatever it was shaken with');
assert.equal(whichQuick([{ ice: 'Cubes', n: 5 }, { ice: 'Pebble', to: 'mound' }]), null, 'changed: no longer the quick build');
assert.deepEqual(quickBuild('dump', id, 'Pebble')[0], { ice: 'Pebble', tin: true });

// --- suggestions ---
const tip = (f: Partial<Parameters<typeof iceTip>[0]> & { layers: IceLayer<string>[] }) => iceTip({ glass: 'collins', methods: [], ...f });
// A 130 mm spear in a 165 mm collins: cubes under it.
const spear = tip({ layers: [{ ice: 'Spear' }], glassHeightMm: 165, spearMm: 130, glassName: 'the Fenwick collins' });
assert.equal(spear?.id, 'spear');
assert.equal(spear?.body, 'The spear is 130 mm and the Fenwick collins is 165 mm tall. A cube under it brings it up to the rim.');
assert.deepEqual(spear?.layers, [{ ice: 'Cubes', n: 1 }, { ice: 'Spear', n: 1 }]);
assert.equal(tip({ layers: [{ ice: 'Spear' }], glassHeightMm: 200, spearMm: 130 })?.yes, 'Put 2 cubes under it');
assert.equal(tip({ layers: [{ ice: 'Spear' }], glassHeightMm: 140, spearMm: 130 }), null, 'near enough');
assert.equal(tip({ layers: [{ ice: 'Spear' }] }), null, 'no height, no guess');
assert.equal(tip({ layers: [{ ice: 'Spear' }], glassHeightMm: 165 })?.body.startsWith('The spear is 133 mm'), true, 'a standard spear when Kit does not say');
// Pebble alone in a tall glass: cubes under it.
assert.equal(tip({ layers: [{ ice: 'Pebble' }], glass: 'highball' })?.id, 'pebble');
assert.equal(tip({ layers: [{ ice: 'Pebble' }], glass: 'rocks' }), null);
assert.equal(tip({ layers: [{ ice: 'Pebble' }], glass: 'highball', off: ['pebble'] }), null, 'No thanks holds');
// Swizzled: top it up first.
assert.equal(tip({ layers: [{ ice: 'Crushed' }], methods: ['Swizzle'] })?.id, 'swizzle');
assert.deepEqual(tip({ layers: [{ ice: 'Crushed' }], methods: ['Swizzle'] })?.layers, [{ ice: 'Crushed', to: 'rim', packed: undefined }, { ice: 'Crushed', to: 'mound' }]);
// A julep: mound it.
assert.equal(tip({ layers: [{ ice: 'Crushed' }], glass: 'julep' })?.id, 'julep');
assert.equal(tip({ layers: [{ ice: 'Crushed', to: 'mound' }], glass: 'julep' }), null);
// Shaken with crushed, over crushed: dump the tin.
assert.equal(tip({ layers: [{ ice: 'Crushed' }], glass: 'rocks', methods: ['Shake'], madeWith: 'Crushed' })?.id, 'dump');
// Nothing for a drink served up, or a build already made.
assert.equal(tip({ layers: [], glass: 'coupe' }), null);
assert.equal(tip({ layers: [{ ice: 'Cubes', n: 4 }, { ice: 'Pebble', to: 'mound' }], glass: 'highball' }), null);

// --- stored rows ---
assert.deepEqual(readIceBuild([{ ice: 'a', n: 4 }, { ice: 'b', to: 'mound', packed: true }, { ice: 3 }, { ice: 'c', n: 99, to: 'up' }]), [
  { ice: 'a', n: 4 },
  { ice: 'b', to: 'mound', packed: true },
  { ice: 'c' },
]);
assert.equal(readIceBuild('x'), null);
assert.equal(readIceBuild([]), null);
assert.deepEqual(toStored([{ ice: { id: 'x', name: 'Cubes' }, n: 4, to: null, packed: false }], (p) => p.id), [{ ice: 'x', n: 4 }]);

console.log('iceBuild checks passed');
