import assert from 'node:assert/strict';

import {
  applyMenuPaste,
  bringInText,
  compileBringIn,
  appendReading,
  pasteRows,
  placedGroups,
  readingText,
  parseAmount,
  parseBringIn,
  parseMenuPaste,
  parseSpecLine,
  type ParsedMenuSection,
} from './paste';
import type { CatalogItem } from './match';
import { blankSection, type MenuLayout } from './menuLayout';
import type { MenuDrink } from '@/types/menus';

assert.equal(parseAmount('30'), 30);
assert.equal(parseAmount('1/2'), 0.5);
assert.equal(parseAmount('1 1/2'), 1.5);
assert.equal(parseAmount('0'), 0);
assert.equal(parseAmount('nope'), null);

const gin = parseSpecLine('30 ml Gin');
assert.equal(gin?.amount, 30);
assert.equal(gin?.unit, 'ml');
assert.equal(gin?.name, 'Gin');
assert.equal(parseSpecLine('30ml Gin')?.unit, 'ml');
assert.equal(parseSpecLine('2 dashes Angostura')?.unit, 'dash');
assert.equal(parseSpecLine('1/2 oz lemon juice')?.amount, 0.5);
assert.equal(parseSpecLine('1 1/2 oz rye')?.amount, 1.5);
assert.equal(parseSpecLine('Stirred'), null);

const menu = parseMenuPaste('Negroni — 18\n\nSignatures:\nMartini - 19\nHighballs:\nGin & Tonic\n', false);
assert.equal(menu.length, 3);
assert.equal(menu[0].name, null);
assert.deepEqual(menu[0].lines[0], { name: 'Negroni', price: '18' });
assert.equal(menu[1].name, 'Signatures');
assert.deepEqual(menu[1].lines[0], { name: 'Martini', price: '19' });
assert.equal(menu[2].lines[0].price, null);

const into = parseMenuPaste('Signatures:\nNegroni — 18\n', true);
assert.equal(into.length, 1);
assert.equal(into[0].lines.length, 1);
assert.equal(into[0].lines[0].name, 'Negroni');

const drink = (id: string, name: string): MenuDrink => ({
  id,
  name,
  kind: 'cocktail',
  line: '',
  price: null,
  imageUrl: null,
  isSketch: false,
  glass: null,
});
const layout: MenuLayout = { name: 'Tonight', coverUrl: null, coverPosition: 50, sections: [blankSection('Drinks')] };
const placed = applyMenuPaste(layout, null, [
  { name: null, drinks: [drink('n', 'Negroni')] },
  { name: 'Signatures', drinks: [drink('m', 'Martini')] },
]);
assert.equal(placed.sections.length, 2);
assert.equal(placed.sections[0].drinks[0].id, 'n');
assert.equal(placed.sections[1].name, 'Signatures');
assert.equal(placed.sections[1].drinks[0].id, 'm');

const catalog: CatalogItem[] = [
  { id: 'gin', name: 'Gin', genericId: null, barId: null },
  { id: 'roku', name: 'Roku', genericId: 'gin', barId: null },
  { id: 'beef', name: 'Beefeater', genericId: 'gin', barId: 'bar' },
  { id: 'tanq', name: 'Tanqueray', genericId: 'gin', barId: 'bar' },
  { id: 'campari', name: 'Campari', genericId: null, barId: null },
];

const noGeneric: CatalogItem[] = [
  { id: 'beef', name: 'Beefeater', genericId: 'gin', barId: 'bar' },
  { id: 'tanq', name: 'Tanqueray', genericId: 'gin', barId: 'bar' },
  { id: 'gin', name: 'Gin', genericId: null, barId: 'other' },
];

const bottles = parseBringIn('Gin\nCampari\n', 'ingredients');
assert.equal(bottles.length, 2);
assert.equal(bottles[0].kind, 'bottle');

const specs = parseBringIn('Negroni\n30 ml Gin\n30 ml Campari\nStirred\n\nMartini\n60 ml Gin\n', 'drinks');
assert.equal(specs.length, 2);
assert.equal(specs[0].lines.length, 2);
assert.deepEqual(specs[0].notes, ['Stirred']);
assert.equal(specs[1].name, 'Martini');

const house = parseBringIn('Gin syrup\n200 g sugar\n200 ml water\n', 'ingredients');
assert.equal(house[0].kind, 'house');

const compiled = compileBringIn(
  specs,
  catalog,
  'bar',
  {},
  {},
  [{ id: 'stir', name: 'Stirred' }],
  [{ id: 'coupe', name: 'Coupe' }],
);
assert.equal(compiled.error, null);
assert.equal(compiled.write?.items.length, 2);
assert.equal(compiled.write?.items[0].methodId, 'stir');
assert.equal(compiled.write?.creates.length, 0);
assert.equal(compiled.write?.items[0].lines[0].ingredientKey, 'id:gin');

const created = compileBringIn(parseBringIn('Negroni\n30 ml Roku Gin\n30 ml Roku Gin\n', 'drinks'), catalog, 'bar', {}, {}, [], []);
assert.equal(created.write?.creates.length, 1);
assert.equal(created.write?.creates[0].genericId, 'gin');
assert.equal(created.write?.items[0].lines[0].ingredientKey, created.write?.items[0].lines[1].ingredientKey);

const needsPick = compileBringIn([{ name: 'Negroni', lines: [{ amount: 30, unit: 'ml', name: 'Gin' }], notes: [], kind: 'cocktail' }], noGeneric, 'bar', {}, {}, [], []);
assert.match(needsPick.error ?? '', /Pick which Gin/);
const pickedWrite = compileBringIn(
  [{ name: 'Negroni', lines: [{ amount: 30, unit: 'ml', name: 'Gin' }], notes: [], kind: 'cocktail' }],
  noGeneric,
  'bar',
  { '0:0': 'beef' },
  {},
  [],
  [],
);
assert.equal(pickedWrite.write?.items[0].lines[0].ingredientKey, 'id:beef');

// A photo reading is matched like a paste: library drinks link, the rest
// come back missing with what the menu listed in them.
const read: ParsedMenuSection[] = [
  { name: 'Signatures', lines: [{ name: 'Paper Plane', price: '18', ingredients: ['Bourbon', 'Aperol'] }, { name: 'negroni', price: '16' }] },
  { name: 'Classics', lines: [{ name: 'Negroni', price: null }] },
];
const rows = pasteRows(read, [drink('n', 'Negroni')], {});
assert.deepEqual(rows.map((r) => r.status), ['missing', 'add', 'skip']);
assert.deepEqual(rows[0].status === 'missing' && rows[0].ingredients, ['Bourbon', 'Aperol']);
assert.equal(rows[1].status === 'add' && rows[1].price, '16');
assert.deepEqual(placedGroups(rows, false), [{ name: 'Signatures', drinks: [{ ...drink('n', 'Negroni'), price: '16' }] }]);

// Another page carries on the section it ends in, unless it starts a new one.
assert.deepEqual(
  appendReading(read, [{ name: null, lines: [{ name: 'Martini', price: null }] }, { name: 'Low', lines: [{ name: 'Spritz', price: null }] }]).map((s) => [s.name, s.lines.length]),
  [['Signatures', 2], ['Classics', 2], ['Low', 1]],
);
assert.equal(appendReading(read, [{ name: 'Classics', lines: [{ name: 'Martini', price: null }] }]).length, 2);
assert.equal(appendReading([], read).length, 2);

// A new menu's empty section gives way to the paste's own headings; drinks
// with no heading still land in it.
const fromPhoto = applyMenuPaste(layout, null, [{ name: 'Signatures', drinks: [drink('m', 'Martini')] }]);
assert.deepEqual(fromPhoto.sections.map((s) => s.name), ['Signatures']);

// Missing drinks go to Bring in with their listed ingredients as "- " lines.
assert.equal(bringInText([{ name: 'Negroni', ingredients: [] }, { name: 'Martini', ingredients: [] }]), 'Negroni\nMartini');
const listed = parseBringIn(bringInText([{ name: 'Paper Plane', ingredients: ['Bourbon', 'Aperol'] }, { name: 'Daiquiri', ingredients: [] }]), 'drinks');
assert.equal(listed.length, 2);
assert.deepEqual(listed[0].lines, [
  { amount: null, unit: null, name: 'Bourbon' },
  { amount: null, unit: null, name: 'Aperol' },
]);
assert.equal(listed[1].name, 'Daiquiri');
assert.equal(listed[1].lines.length, 0);
const unmeasured = compileBringIn(listed, catalog, 'bar', {}, {}, [], []);
assert.equal(unmeasured.error, null);
assert.deepEqual(unmeasured.write?.items[0].lines.map((l) => [l.amount, l.unit]), [[null, null], [null, null]]);

// A read-anything reading lands in Bring in as text it parses back the same way.
const fromReader = readingText([
  {
    name: 'Orchard Fizz',
    by: 'Little Rye',
    lines: [
      { amount: 1.5, unit: 'oz', ingredient: 'Calvados', unsure: false },
      { amount: 0.75, unit: 'oz', ingredient: 'Lemon Juice', unsure: true },
      { amount: null, unit: 'top', ingredient: 'Soda Water', unsure: false },
    ],
    method: 'Shaken',
    glass: 'Collins',
    ice: null,
    garnish: 'Lemon twist',
    notes: null,
  },
]);
assert.deepEqual(fromReader.unsure, ['Orchard Fizz: Lemon Juice']);
const back = parseBringIn(fromReader.text, 'drinks');
assert.equal(back.length, 1);
assert.equal(back[0].name, 'Orchard Fizz');
assert.deepEqual(back[0].lines, [
  { amount: 1.5, unit: 'oz', name: 'Calvados' },
  { amount: 0.75, unit: 'oz', name: 'Lemon Juice' },
  { amount: null, unit: null, name: 'Soda Water' },
]);
assert.deepEqual(back[0].notes, ['Shaken', 'Collins', 'Garnish: Lemon twist', 'By Little Rye']);
