import assert from 'node:assert/strict';

import { canUndo, emptySummary, fromLine, lastTimeLine, readSummary, sourceLabel, toBatch, UNDO_WINDOW_MS } from './bringInBatch';

// Brought in, Last time and Undo all read what a bring-in recorded.

// --- Undo window ---
const now = Date.parse('2026-10-08T20:00:00Z');
assert.equal(canUndo({ createdAt: '2026-10-08T19:00:00Z', undoneAt: null }, now), true);
assert.equal(canUndo({ createdAt: new Date(now - UNDO_WINDOW_MS - 1).toISOString(), undoneAt: null }, now), false);
assert.equal(canUndo({ createdAt: '2026-10-08T19:00:00Z', undoneAt: '2026-10-08T19:30:00Z' }, now), false);

// --- Lines ---
const menu = { ...emptySummary('menu'), drinksNew: 3, drinksHad: 5 };
assert.equal(lastTimeLine({ title: 'Spring menu', summary: menu, createdAt: '2026-10-02T12:00:00Z' }), 'Spring menu, 8 drinks · 2 Oct');
assert.equal(lastTimeLine({ title: 'Back bar', summary: { ...emptySummary('bottles'), bottles: 1 }, createdAt: '2026-10-02T12:00:00Z' }), 'Back bar, 1 bottle · 2 Oct');
assert.equal(fromLine({ source: '2 menu photos', createdAt: '2026-10-08T12:00:00Z' }), 'From 2 menu photos, 8 Oct.');
assert.equal(sourceLabel('menu', { files: 2 }), '2 menu photos');
assert.equal(sourceLabel('recipes', { files: 1, pdfs: 1 }), 'a spec PDF');
assert.equal(sourceLabel('bottles', { files: 1 }), 'a shelf photo');
assert.equal(sourceLabel('recipes', { files: 0 }), 'pasted text');
assert.equal(sourceLabel('recipes', { files: 0, link: true }), 'a link');

// --- Stored rows read safely ---
assert.deepEqual(readSummary(null), emptySummary('recipes'));
assert.deepEqual(readSummary({ kind: 'menu', drinksNew: -2, preps: ['Fig syrup', 4], prepsNoRecipe: [{ id: 'a', name: 'Fig syrup' }, { id: 1 }] }), {
  ...emptySummary('menu'),
  preps: ['Fig syrup'],
  prepsNoRecipe: [{ id: 'a', name: 'Fig syrup' }],
});
const batch = toBatch({ id: 'b1', bar_id: null, source: 'a link', title: 'Orchard Fizz', menu_id: null, item_ids: ['x', 2], summary: {}, created_at: '2026-10-08T12:00:00Z', undone_at: null });
assert.deepEqual(batch.itemIds, ['x']);
assert.equal(batch.summary.kind, 'recipes');
// Plain JSON, so the persisted query cache brings it back whole.
assert.deepEqual(JSON.parse(JSON.stringify(batch)), batch);

console.log('bringInBatch checks passed');
