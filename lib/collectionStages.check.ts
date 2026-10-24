import assert from 'node:assert/strict';

import { beatCount, beenBars, dayShort, gapLabel, hadOutRows, homeReach, madeRows, nearestFirst, nextBottle, toMakeGroups, type HadMemory } from './collectionStages';
import type { HadDrink } from './hadDrinks';

const shelf = {
  canMakeIds: new Set(['sour']),
  oneAway: [
    { bottles: [{ id: 'cynar', name: 'Cynar' }], drinks: [{ id: 'signal' }, { id: 'martinez' }] },
    { bottles: [{ id: 'aperol', name: 'Aperol' }], drinks: [{ id: 'spritz' }] },
  ],
  twoAway: [{ bottles: [{ name: 'Campari' }, { name: 'pineapple juice' }], drinks: [{ id: 'bird' }] }],
};

// --- the shelf: ready, one or two bottles off, or further ---
assert.deepEqual(homeReach('sour', shelf), { kind: 'ready' });
assert.deepEqual(homeReach('signal', shelf), { kind: 'one', need: ['Cynar'] });
assert.deepEqual(homeReach('bird', shelf), { kind: 'two', need: ['Campari', 'pineapple juice'] });
assert.deepEqual(homeReach('flip', shelf), { kind: 'far' });
assert.deepEqual(homeReach(null, shelf), { kind: 'far' });

// --- the gap between your version and the bar's ---
assert.equal(gapLabel(8.9, 8.6), '+0.3');
assert.equal(gapLabel(7.9, 8.6), '−0.7');
assert.equal(gapLabel(8.2, 8.2), '0.0');
assert.equal(dayShort('2026-10-12', Date.parse('2026-10-24'), 'en-GB'), '12 Oct');
assert.equal(dayShort('2025-03-03', Date.parse('2026-10-24'), 'en-GB'), '3 Mar 2025');

const venue = (id: string, name: string) => ({ id, handle: null, name, avatarUrl: null, place: null });
const drink = (over: Partial<HadDrink> & { id: string; itemId: string; score: number }): HadDrink => ({
  name: over.itemId, listName: null, imageUrl: null, isSketch: false, venue: null, sentiment: 'loved', hadOn: null, createdAt: '2026-10-01T10:00:00Z', ...over,
});
const rye = venue('rye', 'Little Rye');
const moth = venue('moth', 'Pale Moth');
const had = [
  drink({ id: 'a', itemId: 'signal', score: 8.9, venue: rye, hadOn: '2026-10-12' }),
  drink({ id: 'a2', itemId: 'signal', score: 8.1, venue: rye, hadOn: '2026-09-01' }),
  drink({ id: 'b', itemId: 'sour', score: 8.4, venue: rye, hadOn: '2026-09-02' }),
  drink({ id: 'c', itemId: 'fig', score: 8.7, venue: rye, hadOn: '2026-10-12' }),
  drink({ id: 'c-home', itemId: 'fig', score: 8.2 }),
  drink({ id: 'd', itemId: 'violet', score: 9.1, venue: moth, hadOn: '2026-03-03' }),
  drink({ id: 'e', itemId: 'moth', score: 8.7, venue: moth, hadOn: '2026-03-03' }),
  drink({ id: 'f', itemId: 'gimlet', score: 7.5, atBar: true }),
];
const kept: HadMemory[] = [
  { id: 'k-moth', itemId: 'moth', name: 'Moth Light', imageUrl: null, barName: 'Pale Moth', hadOn: '2026-03-03', past: true, locked: false },
  { id: 'k-summer', itemId: 'summer', name: 'Summer Negroni', imageUrl: null, barName: 'Little Rye', hadOn: '2026-07-14', past: true, locked: false },
  { id: 'k-violet', itemId: 'violet', name: 'Violet Hour', imageUrl: null, barName: 'Pale Moth', hadOn: null, past: false, locked: true },
];

// --- Had out: one row a drink at your best score, home versions left out, past drinks folded in ---
const best = hadOutRows(had, kept, shelf, 'best');
assert.deepEqual(best.map((r) => r.itemId), ['violet', 'signal', 'fig', 'moth', 'sour', 'gimlet', 'summer']);
assert.equal(best[1].score, 8.9);
assert.deepEqual(best[0].status, { kind: 'locked' });
assert.deepEqual(best[1].status, { kind: 'one', need: ['Cynar'] });
assert.deepEqual(best[2].status, { kind: 'made', score: 8.2 });
assert.deepEqual(best[3].status, { kind: 'off' });
assert.equal(best[3].memoryId, 'k-moth');
assert.deepEqual(best[4].status, { kind: 'ready' });
assert.equal(best[6].score, null);
assert.equal(best[6].memoryId, 'k-summer');
assert.deepEqual(hadOutRows(had, kept, shelf, 'recent').map((r) => r.itemId).slice(0, 2), ['signal', 'fig']);
assert.deepEqual(hadOutRows(had, kept, shelf, 'bar').map((r) => r.bar), ['Little Rye', 'Little Rye', 'Little Rye', 'Little Rye', 'Pale Moth', 'Pale Moth', null]);

// --- To make: groups in order, saved order inside each, locked ones apart ---
const toMake = [
  { itemId: 'bird', name: 'Jungle Bird', locked: false },
  { itemId: 'signal', name: 'Smoke Signal', locked: false },
  { itemId: 'sour', name: 'Burnt Honey Sour', locked: false },
  { itemId: 'violet', name: 'Violet Hour', locked: true },
  { itemId: 'martinez', name: 'Cold Brew Martinez', locked: false },
  { itemId: 'spritz', name: 'Dusk Spritz', locked: false },
];
const groups = toMakeGroups(toMake, shelf);
assert.deepEqual(groups.map((g) => g.title), ['Ready now', 'One bottle away', 'Need more', 'Spec not public']);
assert.deepEqual(groups[1].drinks.map((d) => d.drink.itemId), ['signal', 'martinez', 'spritz']);
assert.deepEqual(groups[2].drinks[0].reach, { kind: 'two', need: ['Campari', 'pineapple juice'] });
assert.deepEqual(toMakeGroups([], shelf), []);

// --- the bottle that opens the most of the list ---
const next = nextBottle(toMake, shelf.oneAway);
assert.deepEqual(next?.bottles, [{ id: 'cynar', name: 'Cynar' }]);
assert.deepEqual(next?.drinks.map((d) => d.name), ['Smoke Signal', 'Cold Brew Martinez']);
assert.equal(nextBottle([{ itemId: 'sour', name: 'Sour' }], shelf.oneAway), null);

// --- Made: your version against your score for the bar's ---
const tally = (itemId: string) => ({ itemId, name: itemId, imageUrl: null, times: 1, lastOn: '2026-10-02' });
const made = madeRows([tally('fig'), tally('negroni')], had, new Set(['negroni']));
assert.deepEqual(made.map((r) => [r.you, r.bar, r.barName, r.classic]), [[8.2, 8.7, 'Little Rye', false], [null, null, null, true]]);
assert.equal(beatCount(made), 0);
assert.equal(beatCount([{ ...made[0], you: 9 }]), 1);
assert.equal(beatCount([{ ...made[0], you: 8.7 }]), 0);

// --- Bars you've been to: your average, best drink, last time ---
const been = beenBars(had, 'score');
assert.deepEqual(been.map((b) => b.venue.name), ['Pale Moth', 'Little Rye']);
assert.deepEqual([been[0].yours, been[0].drinks, been[0].best.name], [8.9, 2, 'violet']);
assert.deepEqual([been[1].yours, been[1].drinks, been[1].last], [8.5, 4, '2026-10-12']);
assert.deepEqual(beenBars(had, 'recent').map((b) => b.venue.name), ['Little Rye', 'Pale Moth']);

// --- Want to go: nearest first, unknown distances last, then by name ---
assert.deepEqual(nearestFirst([{ name: 'B', km: null }, { name: 'C', km: 3 }, { name: 'A', km: null }, { name: 'D', km: 1 }]).map((b) => b.name), ['D', 'C', 'A', 'B']);
