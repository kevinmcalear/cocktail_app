// Checks for lib/awards.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { awardInitials, awardLines, sortAwards } from './awards';

const W50 = "The World's 50 Best Bars";

assert.deepEqual(awardLines({ award: W50, year: 2025, position: 6, title: null }), {
  headline: 'No. 6',
  detail: "The World's 50 Best Bars 2025",
});
assert.deepEqual(awardLines({ award: 'Tales of the Cocktail Spirited Awards', year: 2026, position: null, title: "World's Best Cocktail Bar" }), {
  headline: "World's Best Cocktail Bar",
  detail: 'Tales of the Cocktail Spirited Awards 2026',
});

const SPIRITED = 'Tales of the Cocktail Spirited Awards';
const sorted = sortAwards([
  { award: W50, year: 2024, position: 3, title: null },
  { award: "Asia's 50 Best Bars", year: 2026, position: 12, title: null },
  { award: "Asia's 50 Best Bars", year: 2025, position: null, title: 'Best Bar in Asia' },
  { award: W50, year: 2025, position: 64, title: null },
  { award: "Asia's 50 Best Bars", year: 2026, position: null, title: 'Best Bar in Hong Kong' },
  { award: SPIRITED, year: 2025, position: null, title: 'Best International Cocktail Bar' },
  { award: W50, year: 2025, position: 1, title: null },
  { award: 'Some Local Awards', year: 2026, position: null, title: 'Bar of the Year' },
]);
assert.deepEqual(
  sorted.map((a) => `${awardLines(a).headline} ${a.year}`),
  [
    // 2026: the weightier list first, its title before its place; unknown lists last.
    'Best Bar in Hong Kong 2026',
    'No. 12 2026',
    'Bar of the Year 2026',
    // 2025: The World's 50 Best, then the Spirited Awards, then Asia's.
    'No. 1 2025',
    'No. 64 2025',
    'Best International Cocktail Bar 2025',
    'Best Bar in Asia 2025',
    'No. 3 2024',
  ],
);

console.log('awards checks passed');

assert.equal(awardInitials('James Beard Awards'), 'JBA');
assert.equal(awardInitials('The Good Food Guide'), 'GFG');
assert.equal(awardInitials("Gourmet Traveller's Bar of the Year"), 'GTB');

assert.deepEqual(awardLines({ award: 'Food & Wine Global Tastemakers', year: 2025, position: 3, title: 'Top U.S. Bars' }), {
  headline: 'No. 3',
  detail: 'Food & Wine Global Tastemakers 2025 · Top U.S. Bars',
});
