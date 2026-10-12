import assert from 'node:assert/strict';

import { factTiles, keepLabel, membersLine, ratioTile, swapLine } from './facts';
import { techniqueById } from './index';

assert.equal(keepLabel(14 * 24), '2 weeks');
assert.equal(keepLabel(24 * 7), '1 week');
assert.equal(keepLabel(72), '3 days');
assert.equal(keepLabel(12), '12 h');
assert.equal(keepLabel(5 / 60), '5 min');

// Milk washing: overnight, 1 : 4 milk to batch, two weeks cold.
const milk = techniqueById('milk-wash')!;
assert.deepEqual(factTiles(milk), [
  { value: 'Overnight', caption: 'start to finish' },
  { value: '1 : 4', caption: 'milk : batch' },
  { value: '2 weeks', caption: 'cold, to be safe' },
]);
assert.equal(ratioTile({ base: { name: 'Juice', unit: 'g', amounts: [400] }, parts: [{ name: 'Agar', per: 0.002, unit: 'g' }] })?.value, '1 : 500');
assert.equal(ratioTile({ base: { name: 'Juice', unit: 'g', amounts: [400] }, parts: [{ name: 'Water', per: 0.33, unit: 'g' }] }), null);
assert.equal(ratioTile({ base: undefined, parts: undefined }), null);

assert.equal(membersLine(['Dry shake', 'Siphon foam', 'Lecithin air']), 'Dry shake, siphon foam, lecithin air');
assert.equal(membersLine(['A', 'B', 'C', 'D', 'E'], 2), 'A, B');
// Proper names and acronyms keep their capitals.
assert.equal(membersLine(['Clear ice', 'CO2 rig', 'iSi infusion']), 'Clear ice, CO2 rig, iSi infusion');

assert.equal(swapLine('Vegan: coconut milk.'), 'Vegan swap: coconut milk.');
assert.equal(swapLine('Use honey instead.'), 'Swap: Use honey instead.');

console.log('techniques facts: ok');
