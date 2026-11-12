// Checks for lib/houseMadeParts.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { hasPart, houseMadePayload, houseMadesPayload, partsOf, savesTogether } from './houseMadeParts';
import { startPrep, type PrepDraft, type PrepDraftLine } from './prepKinds';

const line = (key: string, name: string, amount: string, unit: string, more: Partial<PrepDraftLine> = {}): PrepDraftLine => ({ key, id: null, name, parts: null, unit, amount, ...more });
const recipe = (lines: PrepDraftLine[], more: Partial<PrepDraft> = {}): PrepDraft => ({ ...startPrep('other', 'x'), lines, baseKey: lines[0]?.key ?? '', baseAmount: 0, ...more });

// Board Add-parts: Penicillin batch uses Honey-ginger syrup, which uses Fresh ginger juice.
const juice = recipe([line('g', 'Fresh ginger', '1000', 'g', { note: 'unpeeled' })], { keepsHours: 72 });
const syrup = recipe([line('h', 'Honey', '500', 'g', { id: 'honey' }), line('w', 'Water', '250', 'ml', { id: 'water' }), line('j', 'fresh ginger juice', '100', 'ml', { prep: juice })], { allergens: [], allergensSet: true });
const batch = recipe([
  line('s', 'Blended scotch', '500', 'ml', { bottle: true }),
  line('y', 'Honey-ginger syrup', '200', 'ml', { prep: syrup }),
  line('l', 'Laphroaig 10', '25', 'ml', { id: 'laphroaig' }),
  line('x', '', '5', 'ml'),
  line('p', 'Spirit', '', 'ml', { slot: 'spirit' }),
]);

assert.deepEqual(partsOf(batch).map((p) => [p.name, p.level]), [['Honey-ginger syrup', 2], ['Fresh ginger juice', 3]]);
assert.ok(hasPart(batch) && hasPart(syrup) && !hasPart(juice));
assert.equal(savesTogether('penicillin batch', batch), 'Saves 3 house-mades together: Penicillin batch, Honey-ginger syrup and Fresh ginger juice. If one can’t save, none do.');
assert.equal(savesTogether('Fresh ginger juice', juice), null, 'one house-made alone says nothing');

// One call, all of them: itself first, each part after the line that points at it.
const payload = houseMadePayload('penicillin batch', batch);
assert.deepEqual(payload.map((p) => p.name), ['Penicillin batch', 'Honey-ginger syrup', 'Fresh ginger juice']);
assert.deepEqual(payload[0].lines, [
  { name: 'Blended scotch', bottle: true, allergens: [], amount: 500, unit: 'ml', note: null },
  { part: 1, amount: 200, unit: 'ml', note: null },
  { id: 'laphroaig', name: 'Laphroaig 10', amount: 25, unit: 'ml', note: null },
]);
assert.equal(payload[0].base, 0, 'the base line is the first saved');
assert.deepEqual(payload[1].lines.at(-1), { part: 2, amount: 100, unit: 'ml', note: null });
assert.deepEqual(payload[2].lines, [{ name: 'Fresh ginger', allergens: [], amount: 1000, unit: 'g', note: 'unpeeled' }]);
assert.equal(payload[2].card.shelf_life_hours, 72);
// A name to find or add carries the allergens read from it, for save_drink to store on a new ingredient.
assert.deepEqual((houseMadePayload('Brown butter syrup', recipe([line('b', 'brown butter', '50', 'g')]))[0].lines[0] as { allergens: string[] }).allergens, ['milk']);
// Allergens set by hand (even none) are declared; read from the names, they're not.
assert.deepEqual(payload[1].allergens, []);
assert.equal(payload[0].allergens, null);
// Every part points at an entry that is there, after its own.
payload.forEach((p, i) => p.lines.forEach((l) => 'part' in l && assert.ok(l.part > i && l.part < payload.length)));

// A drink's house-mades in one call (board Add-inside): each starts where `at` says, its parts' indexes moved along with it.
const many = houseMadesPayload([{ name: 'Pine syrup', prep: juice }, { name: 'penicillin batch', prep: batch }]);
assert.deepEqual(many.at, [0, 1]);
assert.deepEqual(many.payload.map((p) => p.name), ['Pine syrup', 'Penicillin batch', 'Honey-ginger syrup', 'Fresh ginger juice']);
assert.equal((many.payload[1].lines[1] as { part: number }).part, 2);
assert.equal((many.payload[2].lines.at(-1) as { part: number }).part, 3);
many.payload.forEach((p, i) => p.lines.forEach((l) => 'part' in l && assert.ok(l.part > i && l.part < many.payload.length)));

// The same house-made on two lines (a pour and a finish) goes once, and both lines use it (review of #1187: the call refuses a name twice).
const twice = houseMadesPayload([{ name: 'Pine syrup', prep: juice }, { name: 'penicillin batch', prep: batch }, { name: ' pine  SYRUP', prep: juice }]);
assert.deepEqual(twice.at, [0, 1, 0]);
assert.equal(twice.payload.filter((p) => p.name === 'Pine syrup').length, 1);
assert.equal(twice.payload.length, many.payload.length);

console.log('houseMadeParts checks passed');
