import assert from 'node:assert/strict';

import {
  applyMenuPaste,
  bringInText,
  appendReading,
  pasteRows,
  placedGroups,
  parseAmount,
  parseBringIn,
  parseMenuPaste,
  parseSpecLine,
  typedPour,
  type ParsedMenuSection,
} from './paste';
import { blankSection, type MenuLayout } from './menuLayout';
import type { MenuDrink } from '@/types/menus';

assert.equal(parseAmount('30'), 30);
assert.equal(parseAmount('1/2'), 0.5);
assert.equal(parseAmount('1 1/2'), 1.5);
assert.equal(parseAmount('0'), 0);
assert.equal(parseAmount('nope'), null);

// The add field reads a pour before the name.
assert.deepEqual(typedPour('30 pommeau'), { amount: '30', unit: null, name: 'pommeau' });
assert.deepEqual(typedPour('30ml pommeau'), { amount: '30', unit: 'ml', name: 'pommeau' });
assert.deepEqual(typedPour('1/2 oz lemon juice'), { amount: '1/2', unit: 'oz', name: 'lemon juice' });
assert.deepEqual(typedPour('2 dashes Angostura'), { amount: '2', unit: 'dash', name: 'Angostura' });
assert.deepEqual(typedPour('22,5 lime'), { amount: '22.5', unit: null, name: 'lime' });
assert.deepEqual(typedPour('2 lemon peels'), { amount: '2', unit: null, name: 'lemon peels' });
assert.equal(typedPour('pommeau'), null);
assert.equal(typedPour('30'), null);
assert.equal(typedPour('30 ml'), null);
assert.equal(typedPour('7up'), null);

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
