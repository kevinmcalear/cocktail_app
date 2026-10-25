// Checks for lib/menuEditions.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import {
  drinkRunTags,
  editionCardLine,
  editionPastLine,
  editionDates,
  editionDrinkLine,
  editionMenuDrinks,
  editionSections,
  menuOrder,
  menuRange,
  menuState,
  runDates,
  searchMenuTag,
  sortEditions,
  timelineDates,
  withPastMenuTag,
} from './menuEditions';

// Newest first; a year-only menu after that year's dated ones.
assert.deepEqual(
  sortEditions([
    { name: 'B', year: 2022, month: null },
    { name: 'A', year: 2022, month: 3 },
    { name: 'C', year: 2024, month: 1 },
    { name: 'D', year: 2022, month: 11 },
  ]).map((e) => e.name),
  ['C', 'D', 'A', 'B']
);

// The edition's order wins; a drink the reader couldn't load keeps its name.
const full = { id: 'b', name: 'Bee', kind: 'cocktail' as const, line: 'Gin, honey', price: null, imageUrl: 'x', isSketch: false, glass: null };
const set = editionMenuDrinks([{ id: 'a', name: 'Ay' }, { id: 'b', name: 'Bee' }], [full]);
assert.deepEqual(set.map((d) => d.id), ['a', 'b']);
assert.equal(set[0].name, 'Ay');
assert.equal(set[0].line, '');
assert.equal(set[1], full);

// A venue's menu: an unread drink keeps the venue's price; drinks fall into their sections in order.
const venue = [
  { id: 'a', name: 'Ay', price: '18', section: 'Stirred' },
  { id: 'b', name: 'Bee', price: null, section: 'Long' },
  { id: 'c', name: 'Sea', section: 'Stirred' },
];
const venueSet = editionMenuDrinks(venue, []);
assert.equal(venueSet[0].price, '18');
assert.equal(venueSet[2].price, null);
// A loaded drink on a venue's menu prints the menu's price, not only its own.
const loaded = editionMenuDrinks([{ id: 'b', name: 'Bee', price: '22' }], [{ ...full, price: '19' }]);
assert.equal(loaded[0].price, '19');
assert.equal(loaded[0].menuPrice, '22');
assert.deepEqual(
  editionSections({ id: 'm', drinks: venue }, venueSet).map((s) => [s.name, s.drinks.map((d) => d.id)]),
  [['Stirred', ['a', 'c']], ['Long', ['b']]]
);
// A researched menu has no sections: one "Cocktails".
assert.deepEqual(editionSections({ id: 'm', drinks: [{ id: 'a', name: 'Ay' }] }, set.slice(0, 1)).map((s) => s.name), ['Cocktails']);

// When a menu was on: past with an end, on now, or open-ended when the record stops.
const run = (startYear: number, startMonth: number | null, endYear: number | null, endMonth: number | null, isCurrent = false) => ({
  startYear,
  startMonth,
  endYear,
  endMonth,
  isCurrent,
});
assert.equal(menuRange(run(2024, 3, 2025, 1)), 'Mar 2024 to Jan 2025');
assert.equal(menuRange(run(2025, 9, null, null, true)), 'On now since Sep 2025');
assert.equal(menuRange(run(2019, null, 2021, null)), '2019 to 2021');
assert.equal(menuRange(run(2019, null, 2019, null)), '2019');
assert.equal(menuRange(run(2016, 5, null, null)), 'From May 2016, end date unknown');
assert.equal(menuState(run(2016, 5, null, null)), 'unknown');
assert.equal(menuState(run(2016, 5, 2017, null)), 'past');
assert.equal(menuState(run(2026, 9, null, null, true)), 'current');
assert.deepEqual(editionDates({ year: 2023, month: 7, end_year: 2023, end_month: 10, is_current: false }), run(2023, 7, 2023, 10));

// The bar's timeline: how long a menu ran, and an unknown end said plainly.
assert.equal(timelineDates(run(2024, 3, 2025, 8)), 'Mar 2024 to Aug 2025 · 17 months');
assert.equal(timelineDates(run(2015, 7, 2021, 5)), 'Jul 2015 to May 2021 · 6 years');
assert.equal(timelineDates(run(2023, 7, 2023, 8)), 'Jul 2023 to Aug 2023 · 1 month');
assert.equal(timelineDates(run(2019, null, 2021, null)), '2019 to 2021');
assert.equal(timelineDates(run(2025, 9, null, null, true)), 'On now · since Sep 2025');
assert.equal(timelineDates(run(2021, null, null, null)), '2021 · end date unknown');
assert.equal(editionDrinkLine(['Plum Negroni', 'Lavender Static', 'Rye Garden', 'Cold Brew']), 'Plum Negroni, Lavender Static, Rye Garden and 1 more');
assert.equal(editionDrinkLine(['Plum Negroni']), 'Plum Negroni');
assert.equal(editionDrinkLine([]), 'Drinks not listed in our sources');

assert.deepEqual(runDates({ start_year: 2022, start_month: 2, end_year: null, end_month: null, is_current: true }), run(2022, 2, null, null, true));
assert.deepEqual(withPastMenuTag(['Stirred'], [run(2024, 3, 2025, 1)]), ['Stirred', 'Past menu']);
assert.deepEqual(withPastMenuTag(['Stirred'], [run(2024, 3, null, null, true)]), ['Stirred']);
assert.deepEqual(withPastMenuTag(['Stirred'], [run(2019, null, null, null)]), ['Stirred'], 'an open-ended record is not called past');
assert.deepEqual(withPastMenuTag([], []), []);

// Search: "on now", "Past · dates", nothing for an undated or open-ended drink; current first.
assert.deepEqual(searchMenuTag(run(2025, 9, null, null, true)), { onNow: true });
assert.deepEqual(searchMenuTag(run(2024, 3, 2025, 1)), { onNow: false, past: 'Past · Mar 2024 to Jan 2025' });
assert.equal(searchMenuTag(run(2019, null, null, null)), undefined);
assert.equal(searchMenuTag(null), undefined);
assert.deepEqual([run(2025, 9, null, null, true), null, run(2019, null, null, null), run(2024, 3, 2025, 1)].map(menuOrder), [0, 1, 1, 2]);

// Each drink's latest run on a bar's menus.
const edition = (id: string, year: number, end: number | null, current: boolean, drinks: string[]) => ({
  id, name: id, year, month: 1, end_year: end, end_month: end ? 6 : null, is_current: current, theme: null, source_url: null, drinks: drinks.map((d) => ({ id: d, name: d })),
});
assert.deepEqual(
  drinkRunTags([edition('old', 2022, 2023, false, ['a', 'b']), edition('mid', 2024, 2025, false, ['b']), edition('now', 2025, null, true, ['c', 'a']), edition('lost', 2019, null, false, ['d'])]),
  { c: 'on now', a: 'on now', b: 'Past · Jan 2024 to Jun 2025' }
);

// A bar's menus in the band/line look.
assert.equal(editionCardLine(edition('now', 2025, null, true, ['a', 'b', 'a'])), '2 drinks · since Jan 2025');
assert.equal(editionCardLine(edition('now', 2025, null, true, [])), 'since Jan 2025');
assert.equal(editionPastLine(edition('old', 2024, 2025, false, ['a', 'b'])), 'Jan 2024 to Jun 2025 · 2');
assert.equal(editionPastLine(edition('lost', 2019, null, false, [])), 'From Jan 2019, end date unknown');

console.log('menu editions checks passed');
