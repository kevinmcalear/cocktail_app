// Checks for lib/editPreview.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import type { DatabaseItem } from '@/types/types';

import { EMPTY_DRAFT, type WizardDraft } from './drinkWizard';
import { draftPreviewItem, previewItem, type EditedDrink } from './editPreview';

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
assert.deepEqual((item.item_methods ?? []).map((m) => [m.method_item_id, m.sort_order]), [['shake', 0], ['float', 1]], 'methods in order');
const line = (item.recipes as unknown as { amount: string; preparation_notes: string | null; display_ingredient: { name: string } }[])[0];
assert.equal(line.amount, '60');
assert.equal(line.preparation_notes, null);
assert.equal(line.display_ingredient.name, 'Blended Scotch', 'the line reads by the name typed');

assert.equal(previewItem({ ...edit, methodIceId: null }, saved).method_ice_id, null, 'a saved drink editor clears it');

// --- a drink being added (draftPreviewItem) ---
const draft: WizardDraft = {
  ...EMPTY_DRAFT,
  id: 'draft-1',
  name: ' Paloma ',
  lines: [{ key: 'k1', id: 'teq', name: 'Tequila', amount: '50', unit: 'ml' }],
  garnishes: [{ key: 'k2', id: null, name: 'Salt rim', amount: '', unit: '' }],
  methods: [{ id: 'build', name: 'Build' }, { id: null, name: 'My own way' }],
  glass: { id: 'highball', name: 'Highball' },
  notes: 'Top with grapefruit soda',
  description: 'Bright',
};
const atBar = draftPreviewItem(draft, 'b1');
assert.equal(atBar.id, 'draft-1', 'its id seeds the drawing, as the saved drink will be');
assert.equal(atBar.name, 'Paloma');
assert.equal(atBar.bar_id, 'b1');
assert.equal(atBar.glassware_id, 'highball');
assert.deepEqual((atBar.item_methods ?? []).map((m) => m.method_item_id), ['build'], 'a method typed as a new name waits for the save');
const names = (atBar.recipes as unknown as { display_ingredient: { name: string } }[]).map((r) => r.display_ingredient.name);
assert.deepEqual(names, ['Tequila', 'Salt rim'], 'the finish after the spec');
assert.ok((atBar.recipes as unknown as { display_ingredient_id: string | null }[]).every((r) => r.display_ingredient_id), 'a new name still reads, not as hidden');
assert.equal(atBar.notes, 'Top with grapefruit soda', 'at a venue the notes are the drink’s');
assert.equal(draftPreviewItem(draft, null).notes, null, 'at home they are yours unless shared');
assert.equal(draftPreviewItem({ ...draft, name: '' }, null).name, 'New drink');

// What the page reads of each ingredient, and parts, carry through.
type Read = { part: number | null; display_ingredient: { abv?: number | null; ingredient_role?: string | null } };
const savedAbv = { ...saved, recipes: [{ display_ingredient: { id: 'scotch', name: 'Blended Scotch', abv: 40, density_g_ml: 0.95 } }] } as unknown as DatabaseItem;
const kept = (previewItem(edit, savedAbv).recipes as unknown as Read[])[0];
assert.equal(kept.display_ingredient.abv, 40, 'a saved line keeps its ABV for the strength');
const house = draftPreviewItem({ ...draft, lines: [{ ...draft.lines[0], later: true }] }, 'b1');
assert.equal((house.recipes as unknown as Read[])[0].display_ingredient.ingredient_role, 'prep', 'a house-made line reads as house-made');
const parted = draftPreviewItem({ ...draft, parts: [{ name: 'The drink', lines: ['k1'], methods: [{ id: 'build', name: 'Build' }] }, { name: '', join: 'float', lines: [], methods: [{ id: 'float', name: 'Float' }] }] }, 'b1');
assert.deepEqual(parted.madeInParts, [{ name: 'The drink' }, { name: 'Part 2', join: 'float' }]);
assert.deepEqual((parted.recipes as unknown as Read[]).map((r) => r.part), [1, 2], 'the spec in part 1, the finish in the last');
assert.deepEqual((parted.item_methods ?? []).map((m) => [m.method_item_id, m.part]), [['build', 1], ['float', 2]]);
