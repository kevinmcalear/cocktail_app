import assert from 'node:assert/strict';
import { inSelectedContext, PERSONAL_CONTEXT } from '../lib/barContextFilter';

// ponytail: ring-buffer logic only — mirrors useRecentActivityStore.push
function pushRing<T extends { kind: string; id: string }>(items: T[], entry: T, max = 8): T[] {
  return [entry, ...items.filter((i) => !(i.kind === entry.kind && i.id === entry.id))].slice(0, max);
}

// mirrors recentMatchesContext in useTrackRecent
function recentMatchesContext(
  r: { kind: string; barId?: string | null },
  selectedContextIds: string[]
) {
  if (r.kind === 'quiz') return true;
  if (r.barId === undefined) return true;
  return inSelectedContext(r.barId, selectedContextIds);
}

const a = { kind: 'cocktail', id: '1' };
const b = { kind: 'menu', id: '2' };
const c = { kind: 'quiz', id: '3' };
const d = { kind: 'beer', id: '4' };

let items = pushRing([], a);
items = pushRing(items, b);
items = pushRing(items, c);
assert.equal(items.length, 3);
items = pushRing(items, d);
assert.deepEqual(
  items.map((i) => i.id),
  ['4', '3', '2', '1']
);

items = pushRing(items, c);
assert.deepEqual(
  items.map((i) => i.id),
  ['3', '4', '2', '1']
);

const venueA = { kind: 'cocktail', id: 'x', barId: 'happiness' };
const personal = { kind: 'cocktail', id: 'y', barId: null };
const legacy = { kind: 'cocktail', id: 'z' };
const quiz = { kind: 'quiz', id: 'q' };
assert.equal(recentMatchesContext(venueA, ['other']), false);
assert.equal(recentMatchesContext(venueA, ['happiness']), true);
assert.equal(recentMatchesContext(personal, [PERSONAL_CONTEXT]), true);
assert.equal(recentMatchesContext(personal, ['happiness']), false);
assert.equal(recentMatchesContext(legacy, ['happiness']), true);
assert.equal(recentMatchesContext(quiz, ['happiness']), true);

console.log('recentActivity.check: ok');
