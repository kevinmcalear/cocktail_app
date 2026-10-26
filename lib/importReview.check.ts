import assert from 'node:assert/strict';

import { emptySummary } from '@/lib/bringInBatch';
import { approved, canCheck, fileTitle, isFinished, keepFiles, nextOpen, putBack, rematch, setMark, settle, startReview, takeOut, tally, tallyLine, waitingFor, whenWords, type ImportReview } from '@/lib/importReview';
import type { RecipeReading } from '@/supabase/functions/_shared/anythingRead';

const recipe = (name: string): RecipeReading => ({ name, by: null, lines: [], method: null, glass: null, ice: null, garnish: null, notes: null });
const now = '2026-10-22T10:00:00.000Z';
const fresh = (n: number, over: Partial<Parameters<typeof startReview>[0]> = {}) =>
  startReview({
    id: 'r1',
    userId: 'u1',
    barId: 'bar',
    name: 'Little Rye spec book.pdf',
    source: 'a spec PDF',
    recipes: Array.from({ length: n }, (_, i) => recipe(`Drink ${i + 1}`)),
    files: [],
    choices: [],
    summary: emptySummary('recipes'),
    now,
    ...over,
  });

// Counting: 18 of 46 checked, 15 approved (one still saving), 3 skipped.
let r = fresh(46);
for (let i = 0; i < 14; i++) r = setMark(r, i, 'approved', now, `d${i}`);
r = setMark(r, 14, 'saving', now);
for (let i = 15; i < 18; i++) r = setMark(r, i, 'skipped', now);
assert.deepEqual(tally(r), { total: 46, checked: 18, approved: 15, skipped: 3 });
assert.equal(tallyLine(tally(r)), '18 of 46 checked · 15 approved · 3 skipped');
assert.equal(isFinished(r), false);

// Moving on: the next unchecked one, then round from the top.
assert.equal(nextOpen(r.marks, 17), 18);
assert.equal(nextOpen(['approved', null, 'skipped', 'approved'], 2), 1);
assert.equal(nextOpen(['approved', 'skipped'], 0), null);

// Approve only what isn't saved: a skipped one can still be approved, a saving or approved one never again.
assert.equal(canCheck(r, 0), false);
assert.equal(canCheck(r, 14), false);
assert.equal(canCheck(r, 15), true);
assert.equal(canCheck(r, 30), true);

// A drink saving when the app was killed comes back approved (never saved twice) and unsure.
const back = settle(JSON.parse(JSON.stringify(r)) as ImportReview);
assert.equal(back.marks[14], 'approved');
assert.deepEqual(back.unsure, [14]);
assert.equal(canCheck(back, 14), false);
assert.deepEqual(tally(back), tally(r));
// Settling twice changes nothing.
assert.deepEqual(settle(back), back);
// An approved drink stays approved through a reload, with its drink.
assert.equal(back.marks[3], 'approved');
assert.equal(back.drinkIds[3], 'd3');

// A save adds what it made to the review's summary.
const one = { ...emptySummary('recipes'), drinksNew: 1, ingredients: ['Fig syrup'] };
const two = approved(approved(fresh(2), 0, { drinkId: 'a', summary: one, warnings: [] }, now), 1, { drinkId: 'b', summary: one, warnings: ['No glass'] }, now);
assert.equal(two.summary.drinksNew, 2);
assert.deepEqual(two.summary.ingredients, ['Fig syrup', 'Fig syrup']);
assert.deepEqual(two.warnings, ['No glass']);
assert.equal(isFinished(two), true);

// Only plain JSON is kept, and nothing that dies with the session: a web blob or inline page has no uri.
assert.deepEqual(keepFiles([{ uri: 'blob:https://babyvom.it/1', mimeType: 'application/pdf', name: 'a.pdf' }, { uri: 'data:image/jpeg;base64,xx', mimeType: 'image/jpeg' }, { uri: 'file:///a.jpg', mimeType: 'image/jpeg' }]).map((f) => f.uri), ['', '', 'file:///a.jpg']);
assert.deepEqual(JSON.parse(JSON.stringify(r)), r);

// Scoped to the person and the place: someone else, or the home bar, sees none.
const reviews = { r1: r, r2: { ...fresh(3), id: 'r2', updatedAt: '2026-10-22T11:00:00.000Z' }, done: { ...two, id: 'done', userId: 'u1', barId: 'bar' } };
assert.equal(waitingFor(reviews, 'u1', 'bar')?.id, 'r2');
assert.equal(waitingFor(reviews, 'u2', 'bar'), null);
assert.equal(waitingFor(reviews, 'u1', null), null);
assert.equal(waitingFor(reviews, null, 'bar'), null);

assert.equal(fileTitle('Little Rye spec book.pdf'), 'Little Rye spec book');
assert.equal(fileTitle('Pasted text'), 'Pasted text');
assert.equal(whenWords('2026-10-21T20:00:00', new Date('2026-10-22T09:00:00').getTime()), 'Yesterday');

// Taking out what isn't a drink (E20): gone from the list and the count, the screen on the drink after it; Undo puts it back.
{
  let t = fresh(4);
  t = { ...setMark(t, 3, 'skipped', now), unsure: [3], at: 1 };
  assert.equal(takeOut(setMark(t, 0, 'approved', now, 'd0'), 0, now), null);
  const out = takeOut(t, 1, now)!;
  assert.deepEqual(out.review.recipes.map((x) => x.name), ['Drink 1', 'Drink 3', 'Drink 4']);
  assert.equal(tally(out.review).total, 3);
  assert.equal(out.review.at, 1);
  assert.deepEqual(out.review.unsure, [2]);
  const back = putBack(out.review, out.gone, now);
  assert.deepEqual(back.recipes, t.recipes);
  assert.deepEqual(back.marks, t.marks);
  assert.deepEqual(back.unsure, [3]);
  assert.equal(back.at, 1);
  // The last one out leaves the screen on the one before it.
  assert.equal(takeOut({ ...t, at: 3 }, 3, now)!.review.at, 2);
}

// Kept as house-made: drinks still to check that set its line to "make it new" match again; saved ones and picks stay.
{
  const negroni: RecipeReading = { ...recipe('Negroni'), lines: [{ amount: 30, unit: 'ml', ingredient: 'House sweet vermouth', unsure: false }, { amount: 30, unit: 'ml', ingredient: 'Gin', unsure: false }] };
  let t = fresh(2, { recipes: [negroni, negroni], choices: [] });
  t = { ...t, choices: [0, 1].map(() => ({ name: 'Negroni', madeBy: '', source: '', notes: '', lines: { 0: { fresh: true as const }, 1: { pick: 'gin' } } })) };
  t = setMark(t, 0, 'approved', now, 'd0');
  const again = rematch(t, 'House Sweet Vermouth');
  assert.deepEqual(again.choices[0].lines, t.choices[0].lines);
  assert.deepEqual(again.choices[1].lines, { 1: { pick: 'gin' } });
}

console.log('importReview: ok');
