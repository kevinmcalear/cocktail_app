// Checks for lib/shelfCheck.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { checkShelf, shelfCaption, shelfNeed } from './shelfCheck';
import { specLines } from './spec';

const row = (id: string, name: string, amount: number, unit: string, is_optional = false) => ({ id: `r-${id}`, amount, unit, is_optional, display_ingredient_id: id, display_ingredient: { id, name } });
const lines = specLines([row('mez', 'Mezcal', 45, 'ml'), row('cyn', 'Cynar', 20, 'ml'), row('gf', 'Pink grapefruit', 20, 'ml'), row('ag', 'Agave syrup', 5, 'ml'), row('salt', 'Salt', 1, 'pinch'), row('bit', 'Bitters', 1, 'dash', true)]);

// One bottle short: the board's Smoke Signal, 4 of 5 (the optional line doesn't count).
const one = checkShelf(lines, { ready: false, buy: [{ id: 'cyn', name: 'Cynar' }] })!;
assert.deepEqual(one.missing, ['r-cyn']);
assert.equal(shelfCaption(one), 'You have 4 of 5');
assert.equal(shelfNeed(one), 'Need Cynar');

// A bottle that matches by name only (the server answered with the kind's id).
const byName = checkShelf(lines, { ready: false, buy: [{ id: 'other', name: 'agave syrup' }, { id: 'cyn', name: 'Cynar' }] })!;
assert.deepEqual(byName.missing, ['r-ag', 'r-cyn']);
// Each bottle to buy knows its line, so the list can mark it "On your list".
assert.deepEqual(byName.lineFor, { other: 'r-ag', cyn: 'r-cyn' });
assert.equal(shelfNeed(byName), 'You have 3 of 5');

// The server asks for the kind (Herbal Liqueur) when the spec names a bottle of it (the Last Word's Green Chartreuse).
const lastWord = specLines([row('gin', 'Gin', 22.5, 'ml'), row('gc', 'Green Chartreuse', 22.5, 'ml'), row('mar', 'Maraschino Liqueur', 22.5, 'ml'), row('lime', 'Lime Juice', 22.5, 'ml')]);
const kind = checkShelf(lastWord, { ready: false, buy: [{ id: 'herbal', name: 'Herbal Liqueur' }] }, { gc: 'herbal', mar: 'liqueur' })!;
assert.deepEqual(kind.missing, ['r-gc']);
assert.deepEqual(kind.lineFor, { herbal: 'r-gc' });
assert.equal(shelfCaption(kind), 'You have 3 of 4');

// Ready, and too far for the server to say.
assert.equal(shelfCaption(checkShelf(lines, { ready: true })!), 'You have them all');
assert.equal(shelfNeed(checkShelf(lines, { ready: true })!), 'Ready to make');
assert.equal(shelfCaption(checkShelf(lines, null)!), 'Three or more short');

// No named lines (hidden from this role): nothing to check.
assert.equal(checkShelf([], { ready: true }), null);
