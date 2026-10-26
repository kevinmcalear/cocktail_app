import assert from 'node:assert/strict';
import { draftMethodIds, findByName, methodIcon, orderedMethodIds, toggleId } from './drinkMethods';
import { glassIcon } from './glasswareIcons';

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

// The spec heading's icons: a method by any of its names, a glass by its key or else its name.
assert.equal(methodIcon('Shake'), 'Shaken');
assert.equal(methodIcon('Dry shake'), 'dry shake and shake');
assert.equal(methodIcon('Stirred'), 'Stirred');
assert.equal(methodIcon('Build'), 'Built');
assert.equal(methodIcon('Flask Pour'), 'Flask Pour');
assert.equal(methodIcon('Throw'), 'Thrown');
assert.equal(methodIcon('Whip (iSi)'), null);
assert.equal(glassIcon({ icon_key: 'Coupette', name: 'Nick & Nora' }), 'Coupette');
assert.equal(glassIcon({ icon_key: null, name: 'Double rocks' }), 'Rocks');
assert.equal(glassIcon({ icon_key: 'Gone', name: 'Collins' }), 'Highball');
assert.equal(glassIcon({ name: 'Nick & Nora' }), 'Nick & Nora');
assert.equal(glassIcon({ name: 'Julep Cup' }), null);

console.log('drinkMethods.check: ok');
