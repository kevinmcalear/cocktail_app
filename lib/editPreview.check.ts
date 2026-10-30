// Checks for lib/editPreview.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import type { DatabaseItem } from '@/types/types';

import { previewItem, type EditedDrink } from './editPreview';

const saved = { id: 'd1', name: 'Penicillin', bar_id: 'b1', description: 'Old story', price: 18, method_ice_id: 'ice-old' } as unknown as DatabaseItem;
const edit: EditedDrink = {
  name: '  ',
  description: 'Smoky on top',
  origin: '',
  notes: 'Float the Islay',
  glasswareId: 'rocks',
  familyId: null,
  iceId: 'cube',
  methodIds: ['shake', 'float'],
  recipeItems: [{ ingredient_id: 'scotch', name: 'Blended Scotch', amount: '60', unit: 'ml', preparation_notes: '', is_optional: false }],
};

const item = previewItem(edit, saved);
assert.equal(item.name, 'Penicillin', 'a blank name keeps the saved one');
assert.equal(item.description, 'Smoky on top', 'what is typed shows');
assert.equal(item.origin, null, 'an emptied field reads empty');
assert.equal(item.price, 18, 'what the editor does not hold stays as saved');
assert.equal(item.glassware_id, 'rocks');
assert.equal(item.method_ice_id, 'ice-old', 'a draft editor (no method ice) leaves the saved one');
assert.deepEqual(item.item_methods, [{ method_item_id: 'shake', sort_order: 0 }, { method_item_id: 'float', sort_order: 1 }], 'methods in order');
const line = (item.recipes as unknown as { amount: string; preparation_notes: string | null; display_ingredient: { name: string } }[])[0];
assert.equal(line.amount, '60');
assert.equal(line.preparation_notes, null);
assert.equal(line.display_ingredient.name, 'Blended Scotch', 'the line reads by the name typed');

assert.equal(previewItem({ ...edit, methodIceId: null }, saved).method_ice_id, null, 'a saved drink editor clears it');
