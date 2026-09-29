import assert from 'node:assert/strict';

import { groupAccolades, menuDate, sortEditions, type Accolade } from './accolades';

const a = (award: string, year: number, position: number | null, title: string | null = null): Accolade => ({
  id: `${award}-${year}-${position}-${title}`,
  award,
  year,
  position,
  title,
  source_url: null,
});

const W50 = "The World's 50 Best Bars";
const SPIRITED = 'Tales of the Cocktail Spirited Awards';

const groups = groupAccolades([
  a(SPIRITED, 2023, null, 'Best International Cocktail Bar'),
  a(W50, 2023, 11),
  a(W50, 2025, 1),
  a(W50, 2025, null, "The World's Best Bar"),
  a(W50, 2024, 4),
]);

// The longest run leads; newest year first; a placing before a named award.
assert.deepEqual(
  groups.map((g) => g.award),
  [W50, SPIRITED]
);
assert.deepEqual(
  groups[0].entries.map((e) => `${e.year} ${e.label}`),
  ['2025 No. 1', "2025 The World's Best Bar", '2024 No. 4', '2023 No. 11']
);
assert.equal(groups[0].best, 1);
assert.equal(groups[1].best, null);
assert.deepEqual(groupAccolades([]), []);

assert.equal(menuDate({ year: 2023, month: 5 }), 'May 2023');
assert.equal(menuDate({ year: 2019, month: null }), '2019');
assert.equal(menuDate({ year: 2019, month: 12 }), 'December 2019');

assert.deepEqual(
  sortEditions([
    { name: 'B', year: 2022, month: null },
    { name: 'A', year: 2022, month: 3 },
    { name: 'C', year: 2024, month: 1 },
    { name: 'D', year: 2022, month: 11 },
  ]).map((e) => e.name),
  ['C', 'D', 'A', 'B']
);

console.log('accolades: ok');
