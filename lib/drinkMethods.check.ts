import assert from 'node:assert/strict';
import { draftMethodIds, findByName, orderedMethodIds, toggleId } from './drinkMethods';

// Drafts: the list wins; an old single methodId still reads.
assert.deepEqual(draftMethodIds({ methodIds: ['stir', 'freezer'] }), ['stir', 'freezer']);
assert.deepEqual(draftMethodIds({ methodId: 'stir' }), ['stir']);
assert.deepEqual(draftMethodIds({ methodIds: [], methodId: 'stir' }), []);
assert.deepEqual(draftMethodIds({ methodIds: ['stir', null, ''] }), ['stir']);
assert.deepEqual(draftMethodIds(null), []);

assert.deepEqual(
  orderedMethodIds([{ method_item_id: 'freezer', sort_order: 1 }, { method_item_id: 'stir', sort_order: 0 }]),
  ['stir', 'freezer']
);
assert.deepEqual(orderedMethodIds(undefined), []);

assert.deepEqual(toggleId(['stir'], 'freezer'), ['stir', 'freezer']);
assert.deepEqual(toggleId(['stir', 'freezer'], 'stir'), ['freezer']);

// "freezer  pour" matches the existing "Freezer Pour" instead of making another.
const methods = [{ id: 'm1', name: 'Stir' }, { id: 'm2', name: 'Freezer Pour' }];
assert.equal(findByName(methods, ' freezer  pour ')?.id, 'm2');
assert.equal(findByName(methods, 'Freezer'), undefined);

console.log('drinkMethods.check: ok');
