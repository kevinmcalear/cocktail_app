import assert from 'node:assert/strict';

import { sortMatches, type MatchRow } from './barMatches';

const row = (name: string, missing: [string, string][] = [], uses: string[] = []): MatchRow => ({
  id: name,
  name,
  image_url: null,
  glassware_id: null,
  missing_id: missing[0]?.[0] ?? null,
  missing_name: missing[0]?.[1] ?? null,
  missing2_id: missing[1]?.[0] ?? null,
  missing2_name: missing[1]?.[1] ?? null,
  uses,
});

const sorted = sortMatches(
  [
    row('Americano', [['v', 'Sweet Vermouth']]),
    row('Boulevardier', [['v', 'Sweet Vermouth']]),
    row('Campari Soda', [], ['campari', 'soda']),
    row('Gimlet', [['g', 'Gin']]),
    row('Gold Rush', [], ['bourbon', 'lemon']),
    row('Hanky Panky', [['g', 'Gin'], ['v', 'Sweet Vermouth']]),
    row('Negroni', [['g', 'Gin'], ['v', 'Sweet Vermouth']]),
    row('Whiskey Sour', [], ['bourbon', 'lemon']),
  ],
  (r) => r.name
);

assert.deepEqual(sorted.canMake, ['Campari Soda', 'Gold Rush', 'Whiskey Sour']);
// One away: the bottle opening the most drinks first, each group's drinks A to Z.
assert.deepEqual(
  sorted.oneAway.map((g) => [g.buy.map((b) => b.name), g.drinks]),
  [
    [['Sweet Vermouth'], ['Americano', 'Boulevardier']],
    [['Gin'], ['Gimlet']],
  ]
);
// Two away: grouped by the pair, never mixed into one away.
assert.deepEqual(sorted.twoAway.map((g) => [g.buy.map((b) => b.name), g.drinks]), [[['Gin', 'Sweet Vermouth'], ['Hanky Panky', 'Negroni']]]);
// Uses counts ready drinks only.
assert.deepEqual(sorted.usedIn, { campari: 1, soda: 1, bourbon: 2, lemon: 2 });

// Rows from before uses and two away (no such columns) still sort.
const old = sortMatches([{ id: 'a', name: 'A', image_url: null, glassware_id: null, missing_id: null, missing_name: null }], (r) => r.id);
assert.deepEqual(old, { canMake: ['a'], oneAway: [], twoAway: [], usedIn: {} });

console.log('barMatches.check: ok');
