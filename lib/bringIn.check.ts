import assert from 'node:assert/strict';

import { boxRect, cropLayout, foundLine, isCleanText, isPrepName, localReading, looksLike, prepRatio, readingName, readingSteps, readingPages, shelfOrder, stepsDone, stripWindow } from './bringIn';

// Bring in reads clean text on the phone, says what it's doing while the
// reader works, and crops the printed line beside each row.

// --- Clean text stays on the phone; prose, captions and links go to the reader ---
assert.equal(isCleanText('Orchard Fizz\n45 ml calvados\n15 ml pear liqueur'), true);
assert.equal(isCleanText('Negroni - 16\nMartinez - 17'), true);
assert.equal(isCleanText('Campari\nRittenhouse Rye\nLillet Blanc'), true);
assert.equal(isCleanText('Shake the gin and the lemon with ice until cold, then strain into a coupe.'), false);
assert.equal(isCleanText('https://punchdrink.com/recipes/negroni/'), false);
assert.equal(isCleanText('   '), false);

const recipe = localReading('Orchard Fizz\n45 ml calvados\n1/2 oz pear liqueur\n- soda\nTop with soda water\nShaken\nGarnish: lemon twist\nBy Little Rye\nServe cold');
assert.equal(recipe.kind, 'recipes');
assert.deepEqual(recipe.recipes[0], {
  name: 'Orchard Fizz',
  by: 'Little Rye',
  lines: [
    { amount: 45, unit: 'ml', ingredient: 'calvados', unsure: false },
    { amount: 0.5, unit: 'oz', ingredient: 'pear liqueur', unsure: false },
    { amount: null, unit: null, ingredient: 'soda', unsure: false },
    { amount: null, unit: 'top', ingredient: 'soda water', unsure: false },
  ],
  method: 'Shaken',
  glass: null,
  ice: null,
  garnish: 'lemon twist',
  notes: 'Serve cold',
});
const menu = localReading('Stirred:\nNegroni - 16\nMartinez - 17');
assert.equal(menu.kind, 'menu');
assert.deepEqual(menu.menu?.sections, [{ name: 'Stirred', lines: [{ name: 'Negroni', price: '16', ingredients: [] }, { name: 'Martinez', price: '17', ingredients: [] }] }]);
// Reading as: the same list as bottles.
assert.deepEqual(localReading('- Campari\nLillet Blanc', 'bottles').bottles.map((b) => b.name), ['Campari', 'Lillet Blanc']);

// --- What the Reading view says ---
const reading = { kind: 'menu' as const, menu: { title: 'Little Rye, Spring', sections: [{ name: 'A', lines: [{ name: 'Negroni', price: null, ingredients: [] }] }, { name: 'B', lines: [{ name: 'Daiquiri', price: null, ingredients: [] }] }] }, recipes: [], bottles: [] };
assert.deepEqual(readingSteps({ pages: 2, reading: null, matched: null }).map((s) => [s.label, s.state]), [['Reading 2 pages', 'now'], ['Matching to your bar', 'next']]);
const steps = readingSteps({ pages: 2, reading, matched: null });
// The catalog still downloading: how far it's got, on the matching step.
assert.equal(readingSteps({ pages: 1, reading, matched: null, catalog: 0.375 }).find((s) => s.state === 'now')?.detail, '· getting the catalog, 38%');
assert.deepEqual(steps.map((s) => s.label), ['Found a menu: Little Rye, Spring', '2 drinks in 2 sections', 'Matching to your bar', 'Reading ingredients for new drinks']);
const done = readingSteps({ pages: 2, reading, matched: { have: 1, total: 2, newDrinks: 1 } });
assert.equal(done[2].detail, '· 1 of 2 already yours');
assert.equal(stepsDone(done), 100);
assert.ok(stepsDone(steps) > 0 && stepsDone(steps) < 100);
assert.equal(readingName(reading), 'the Little Rye, Spring menu');
assert.equal(readingName({ ...reading, menu: { ...reading.menu, title: 'Spring Menu' } }), 'the Spring Menu');
assert.equal(foundLine(reading), '2 drinks in 2 sections');
assert.equal(looksLike(reading, 2), 'Looks like a menu · 2 pages');
assert.equal(looksLike(recipe, 1), 'Looks like a recipe');

// --- Preps ---
assert.equal(isPrepName('Fig syrup'), true);
assert.equal(isPrepName('Rye whiskey'), false);
assert.equal(prepRatio('Honey Syrup 2:1'), '2 honey, 1 water');
assert.equal(prepRatio('Fig syrup'), null);

// --- A shelf numbered left to right, the unreadable bottle in its place ---
const shelf = shelfOrder({
  kind: 'bottles',
  menu: null,
  recipes: [],
  bottles: [
    { brand: null, name: 'Campari', kind: null, abv: null, at: { page: 0, box: [300, 300, 900, 400] } },
    { brand: null, name: 'Beefeater', kind: null, abv: null, at: { page: 0, box: [300, 10, 900, 200] } },
    { brand: null, name: 'No place', kind: null, abv: null },
  ],
  unreadable: [{ at: { page: 0, box: [300, 210, 900, 290] } }],
});
assert.deepEqual(shelf.map((s) => (s.kind === 'bottle' ? s.reading.name : 'unreadable')), ['Beefeater', 'unreadable', 'Campari', 'No place']);

// --- Crops: the box fills the frame ---
const crop = cropLayout([100, 200, 200, 600], { width: 1000, height: 2000 }, { width: 64, height: 44 });
// The box is 400 x 200 px of the photo; to fill 64 x 44 it scales by max(64/400, 44/200) = 0.22.
assert.equal(Math.round(crop.width), 220);
assert.equal(Math.round(crop.left), -44 + Math.round((64 - 88) / 2));
assert.deepEqual(boxRect([100, 200, 300, 600], { width: 300, height: 400 }), { left: 60, top: 40, width: 120, height: 80 });

// The reading strip: six pages and "+6", always with the page shown.
assert.deepEqual(stripWindow(4, 3), { from: 0, to: 4 });
assert.deepEqual(stripWindow(12, 1), { from: 0, to: 6 });
assert.deepEqual(stripWindow(12, 7), { from: 5, to: 11 });
assert.deepEqual(stripWindow(12, 11), { from: 6, to: 12 });

// A PDF drawn on the phone becomes its pages, each still from file 1; a photo is itself.
const pdf = { uri: 'file:///book.pdf', mimeType: 'application/pdf' };
const photo = { uri: 'file:///p.jpg', mimeType: 'image/jpeg' };
const drawn = { 'file:///book.pdf': [{ uri: 'a.jpg', mimeType: 'image/jpeg' }, { uri: 'b.jpg', mimeType: 'image/jpeg' }] };
assert.deepEqual(readingPages([photo, pdf], drawn).map((p) => [p.file.uri, p.of, p.drawn]), [['file:///p.jpg', 0, false], ['a.jpg', 1, true], ['b.jpg', 1, true]]);
assert.deepEqual(readingPages([pdf], undefined).map((p) => [p.file.uri, p.drawn]), [['file:///book.pdf', false]]);

console.log('bringIn checks passed');
