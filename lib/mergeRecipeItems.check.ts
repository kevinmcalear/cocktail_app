import assert from 'node:assert/strict';
import {
    applyCreateToParent,
    defaultBatchName,
    isDefaultBatchName,
    NEW_BATCH_NAME,
    planMerge,
} from './mergeRecipeItems';

assert.equal(defaultBatchName('Negroni'), 'Negroni batch');
assert.equal(defaultBatchName('  '), NEW_BATCH_NAME);
assert.equal(defaultBatchName(null), NEW_BATCH_NAME);
assert.equal(isDefaultBatchName('Negroni batch'), true);
assert.equal(isDefaultBatchName(NEW_BATCH_NAME), true);
assert.equal(isDefaultBatchName('Gin'), false);

const gin = { ingredient_id: 'gin', name: 'Gin', amount: '1', unit: 'oz' };
const campari = { ingredient_id: 'campari', name: 'Campari', amount: '1', unit: 'oz' };
const vermouth = { ingredient_id: 'vermouth', name: 'Sweet Vermouth', amount: '1', unit: 'oz' };
const batch = { ingredient_id: 'batch-1', name: 'New batch', amount: '', unit: '' };
const oil = { ingredient_id: 'oil', name: 'Coconut Oil', amount: '', unit: '' };

const batches = new Set(['batch-1']);
const isBatch = (id: string) => batches.has(id);

// create: smash two raw lines
const createPlan = planMerge([gin, campari, vermouth], 0, 1, isBatch);
assert.equal(createPlan?.mode, 'create');
if (createPlan?.mode === 'create') {
    assert.deepEqual(
        createPlan.childItems.map((c) => c.ingredient_id),
        ['gin', 'campari']
    );
    const next = applyCreateToParent(
        [gin, campari, vermouth],
        0,
        1,
        { ingredient_id: 'batch-1', name: NEW_BATCH_NAME, amount: '', unit: '' }
    );
    assert.deepEqual(
        next.map((i) => i.ingredient_id),
        ['batch-1', 'vermouth']
    );
    assert.equal(next[0].amount, '');
}

// append onto existing batch (mutate in place, no new branch)
const appendPlan = planMerge([batch, oil, vermouth], 1, 0, isBatch);
assert.equal(appendPlan?.mode, 'append');
if (appendPlan?.mode === 'append') {
    assert.equal(appendPlan.batchIngredientId, 'batch-1');
    assert.equal(appendPlan.appendItem.ingredient_id, 'oil');
    assert.deepEqual(
        appendPlan.nextParentItems.map((i) => i.ingredient_id),
        ['batch-1', 'vermouth']
    );
}

// drop batch onto raw → batch survives, raw appends into it
const dropBatchOnRaw = planMerge([gin, batch], 1, 0, isBatch);
assert.equal(dropBatchOnRaw?.mode, 'append');
if (dropBatchOnRaw?.mode === 'append') {
    assert.equal(dropBatchOnRaw.batchIngredientId, 'batch-1');
    assert.equal(dropBatchOnRaw.appendItem.ingredient_id, 'gin');
}

// batch onto batch → target survives, dragged nests as one line
const batch2 = { ingredient_id: 'batch-2', name: 'Other', amount: '', unit: '' };
batches.add('batch-2');
const batchOnBatch = planMerge([batch, batch2], 1, 0, isBatch);
assert.equal(batchOnBatch?.mode, 'append');
if (batchOnBatch?.mode === 'append') {
    assert.equal(batchOnBatch.batchIngredientId, 'batch-1');
    assert.equal(batchOnBatch.appendItem.ingredient_id, 'batch-2');
}

assert.equal(planMerge([gin], 0, 0, isBatch), null);

console.log('mergeRecipeItems.check.ts: ok');
