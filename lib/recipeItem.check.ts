import assert from 'node:assert/strict';
import { fromLine, toLine, type SortableRecipeItem } from './recipeItem';

const saved: SortableRecipeItem = { id: 'row1', ingredient_id: 'lemon', name: 'Lemon juice', amount: '22.5', unit: 'ml', preparation_notes: 'fresh', is_optional: true, is_float: true };

// A saved line keys by its row, names its ingredient as the line's id, and keeps its note and optional.
const line = toLine(saved, 0);
assert.equal(line.key, 'row1');
assert.equal(line.id, 'lemon');
assert.equal(line.note, 'fresh');
assert.equal(line.rowId, 'row1');
assert.equal(line.optional, true);
assert.equal(line.float, true, 'a float comes through (tf-060)');

// Round trip: the row id, note and optional come back; the key stays for the next render.
assert.deepEqual(fromLine(line), { ...saved, key: 'row1' });

// A line made while editing: no ingredient yet, its recipe kept until it saves.
const made = fromLine({ key: 'k1', id: null, name: 'Penicillin batch', amount: '82.5', unit: 'ml', later: true });
assert.equal(made.ingredient_id, '');
assert.equal(made.id, undefined);
assert.equal(made.later, true);
assert.equal(toLine(made, 3).key, 'k1');
assert.equal(toLine(made, 3).id, null);

// A line with neither row nor key (a new ingredient handed back) keys by its ingredient and place.
assert.equal(toLine({ ingredient_id: 'x', name: 'X', amount: '', unit: 'ml' }, 2).key, 'x-2');

console.log('recipeItem ok');
