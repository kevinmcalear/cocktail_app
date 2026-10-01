import assert from 'node:assert/strict';

import { applyMenuPaste, compileBringIn, matchByName, matchIngredient, parseAmount, parseBringIn, parseMenuPaste, parseSpecLine, type CatalogItem } from './paste';
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
assert.equal(matchIngredient('gin', catalog, 'bar').kind === 'use' && (matchIngredient('gin', catalog, 'bar') as { id: string }).id, 'gin');
assert.equal(matchIngredient('Beefeater', catalog, 'bar').kind === 'use' && (matchIngredient('Beefeater', catalog, 'bar') as { id: string }).id, 'beef');
const roku = matchIngredient('Roku Gin', catalog, 'bar');
assert.equal(roku.kind, 'new');
if (roku.kind === 'new') assert.equal(roku.genericId, 'gin');

const noGeneric: CatalogItem[] = [
  { id: 'beef', name: 'Beefeater', genericId: 'gin', barId: 'bar' },
  { id: 'tanq', name: 'Tanqueray', genericId: 'gin', barId: 'bar' },
  { id: 'gin', name: 'Gin', genericId: null, barId: 'other' },
];
const picked = matchIngredient('Gin', noGeneric, 'bar');
assert.equal(picked.kind, 'pick');
if (picked.kind === 'pick') assert.equal(picked.options.length, 3);

assert.equal(matchByName('Martini', [{ name: 'Martini' }, { name: 'Martini' }]).kind, 'many');

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
