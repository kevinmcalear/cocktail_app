// Checks for lib/makeItHouse.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { houseNudge, houseWays } from './makeItHouse';
import { nameFor } from './techniques/template';

const ids = (list: { id: string }[]) => list.map((t) => t.id);

// A rum lists the washes first, then infusions; never syrups, foams or methods.
const rum = ids(houseWays('Bacardí Carta Blanca', 'White Rum'));
assert.equal(rum[0], 'fat-wash', 'a spirit leads with fat washing');
assert.ok(rum.includes('milk-wash') && rum.includes('cold-infusion'), 'washes and infusions for a spirit');
assert.ok(!rum.includes('syrup-by-weight') && !rum.includes('siphon-foam') && !rum.includes('reverse-dry-shake'), 'nothing made from scratch, no finishes, no methods');
assert.ok(!rum.includes('agar-quick'), 'a juice method is not offered for a rum');

// A juice lists clarifying, not washes.
const lime = ids(houseWays('Lime juice'));
assert.ok(lime.includes('agar-quick'), 'a juice can be clarified');
assert.ok(!lime.includes('fat-wash'), 'a juice is not fat washed');
assert.ok(!lime.includes('infused-oil') && !lime.includes('tepache'), 'made from scratch, not from the line');

// The drink's name says it: the rum line is the one to wash, with coconut.
const lines = [
  { key: 'a', id: 'bacardi', name: 'Bacardí Carta Blanca', styleName: 'White Rum' },
  { key: 'b', id: 'lime', name: 'Lime juice' },
];
const nudge = houseNudge('Coconut Fat-Washed Daiquiri', lines);
assert.ok(nudge, 'the name nudges');
assert.equal(nudge.key, 'a');
assert.equal(nudge.technique.id, 'fat-wash');
assert.equal(nudge.adjunct, 'Coconut');
assert.equal(nudge.phrase, 'coconut fat-washed');
assert.equal(nameFor(nudge.technique, { base: 'Bacardí Carta Blanca', adjunct: nudge.adjunct }), 'Coconut fat-washed Bacardí Carta Blanca', 'flavour, technique, exact bottle');

assert.equal(houseNudge('Daiquiri', lines), null, 'an ordinary name says nothing');
assert.equal(houseNudge('Coconut Fat-Washed Daiquiri', [{ ...lines[0], prep: {} }, lines[1]]), null, 'once a line is house-made, no nudge');
assert.equal(houseNudge('Coconut Fat-Washed Daiquiri', [lines[1]]), null, 'no spirit line, nothing to wash');
assert.equal(houseNudge('Coconut Fat-Washed Daiquiri', [{ key: 'c', id: null, name: 'White rum' }]), null, 'a line not yet in the catalog is made in house from the search instead');

console.log('makeItHouse.check: ok');
