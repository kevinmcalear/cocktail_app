// Checks for lib/specPaste.ts and readHouse in lib/makeItHouse.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { readHouse } from './makeItHouse';
import { readSpec } from './specPaste';

const rows = [
  { id: 'carta', name: 'Bacardí Carta Blanca', generic_id: 'rum' },
  { id: 'eight', name: 'Bacardí 8', generic_id: 'rum' },
  { id: 'washed', name: 'Coconut Fat Washed Bacardi' },
  { id: 'rum', name: 'White Rum' },
  { id: 'lime', name: 'Lime juice' },
  { id: 'simple', name: 'Simple syrup' },
  { id: 'mint-oil', name: 'Mint oil' },
  { id: 'soda', name: 'Soda water' },
];

// One typed line: the way, the "with what" and the bottles it could be. A made thing is never the bottle.
const read = readHouse('coconut fat-washed bacardi', rows);
assert.ok(read, 'a wash on a bottle is read');
assert.equal(read.technique.id, 'fat-wash');
assert.equal(read.adjunct, 'Coconut');
assert.equal(read.base, 'Bacardi');
assert.equal(read.phrase, 'coconut fat-washed');
assert.deepEqual(read.bottles.map((b) => b.id).sort(), ['carta', 'eight'], 'the bottles, not the catalog wash');
assert.equal(readHouse('coconut fat-washed bacardi', rows, { have: new Set(['carta']) })?.bottles[0].id, 'carta', 'the one on your back bar first');
assert.equal(readHouse('Coconut fat washed rum', rows)?.bottles[0].id, 'rum', 'a kind is a bottle too');
assert.equal(readHouse('Bacardí Carta Blanca', rows), null, 'a plain bottle says no technique');
assert.equal(readHouse('fat-washed unobtainium', rows), null, 'no bottle it could start from');
assert.equal(readHouse('Clarified lime juice', rows)?.bottles[0].id, 'lime', 'a juice can be made house too');
const shelf = [{ id: 'falernum', name: 'Bacardi Falernum' }, { id: 'oro', name: 'Bacardí Carta Oro', generic_id: 'rum' }, ...rows];
assert.deepEqual(readHouse('coconut fat-washed bacardi', shelf)?.bottles.map((b) => b.id).sort(), ['carta', 'eight', 'oro'], 'rums before a liqueur a wash can’t start from');

// A whole spec: the name skipped, amounts kept as typed, the wash marked, the finish sent to the finish.
const spec = readSpec(
  'Coconut Fat-Washed Daiquiri\n2 oz coconut fat-washed Bacardi\n1 oz lime juice\n.5 oz simple syrup\n3 drops mint oil on top\nShake, fine strain\nTop soda water',
  rows,
  { drinkName: 'Coconut Fat-Washed Daiquiri', have: new Set(['carta']) },
);
assert.deepEqual(
  spec.map((r) => [r.kind, r.amount, r.unit, r.pick.id]),
  [
    ['skip', '', null, null],
    ['line', '2', 'oz', 'carta'],
    ['line', '1', 'oz', 'lime'],
    ['line', '0.5', 'oz', 'simple'],
    ['finish', '3', 'drop', 'mint-oil'],
    ['skip', '', null, null],
    ['line', '', 'top', 'soda'],
  ],
);
assert.equal(spec[0].note, 'The drink’s name');
assert.deepEqual(spec[1].house, { technique: 'fat-wash', adjunct: 'Coconut', phrase: 'coconut fat-washed' });
assert.equal(spec[2].house, undefined, 'a plain line is just a line');
assert.equal(spec[5].note, 'Set in its own step');

// Odd lines: a garnish heading goes to the finish, a name with no amount is a line, a new name stays as written.
const odd = readSpec('Garnish: mint oil\n- Campari\n30 ml yuzu sake', rows);
assert.deepEqual(odd.map((r) => [r.kind, r.pick.id, r.pick.name]), [
  ['finish', 'mint-oil', 'Mint oil'],
  ['line', null, 'Campari'],
  ['line', null, 'Yuzu sake'],
]);
assert.deepEqual(readSpec('\n  \n', rows), [], 'nothing pasted, nothing read');

console.log('specPaste checks passed');
