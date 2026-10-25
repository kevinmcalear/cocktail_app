import assert from 'node:assert/strict';

import { byKit, needsText } from './kitFirst';
import { kitFirstWay, waysByKit } from '../prepKinds';

// Kit first, nothing dropped, the order kept.
const list = [{ id: 'a', equipment: ['sous-vide'] }, { id: 'b', equipment: [] }, { id: 'c', equipment: ['whipper'] }];
const split = byKit(list, new Set(['whipper']));
assert.deepEqual(split.have.map((t) => t.id), ['b', 'c']);
assert.deepEqual(split.need.map((t) => t.id), ['a']);

assert.equal(needsText(['microwave']), 'Needs a microwave');
assert.equal(needsText(['droppers']), 'Needs dasher and dropper bottles');
assert.equal(needsText(['scale-fine']), 'Needs a fine scale (0.01 g)');
assert.equal(needsText(['centrifuge', 'scale-fine']).startsWith('Needs a '), true);

// An infusion with a whipper and a circulator: those two and cold come first, the rest dimmed after.
const ways = waysByKit('infusion', new Set(['whipper', 'sous-vide']));
assert.deepEqual(ways.have.map((w) => w.id), ['cold', 'sous-vide', 'nitrous']);
assert.ok(ways.need.some((w) => w.id === 'vacuum'));
// Syrups' ways are recipes: always there.
assert.equal(waysByKit('syrup', new Set()).need.length, 0);
// A vegan wash needs a thermometer: a wash starts as a fat wash, and as vegan only when that's the way picked.
assert.equal(kitFirstWay('wash', new Set())?.id, 'fat');
// With no fine scale or centrifuge, a clarified juice starts with agar freeze-thaw.
assert.equal(kitFirstWay('clarified', new Set())?.id, 'agar-freeze');
