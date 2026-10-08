import assert from 'node:assert/strict';

import { PANTRY } from '@/constants/pantry';

import { paintBottle } from './bottle';
import { ingredientArt, type IngredientArt } from './ingredientArt';
import { paintProduce } from './produce';

const kind = (a: IngredientArt) => (a.kind === 'bottle' ? a.inputs.shape : a.inputs.kind);
const art = (names: string[], role: string | null = 'generic') => ingredientArt(names, role, names[0]);

// Own name first, then the kinds above it.
assert.equal(kind(art(['Lime Juice', 'Lime', 'Citrus'])), 'citrus');
assert.equal(kind(art(['Lime Cordial', 'Cordial'])), 'apothecary', 'what it is in beats what it is made of');
assert.equal(kind(art(['Bacardí Carta Blanca', 'White Rum', 'Rum', 'Spirit'], 'product')), 'tall');
const white = art(['Bacardí Carta Blanca', 'White Rum', 'Rum'], 'product');
assert.ok(white.kind === 'bottle' && white.inputs.liquid.alpha < 0.2, 'white rum is clear');
assert.equal(kind(art(['Tanqueray', 'London Dry Gin', 'Gin'], 'product')), 'gin');
assert.equal(kind(art(['Sweet Vermouth', 'Vermouth', 'Aromatised Wine', 'Wine'])), 'longneck');
assert.equal(kind(art(['Angostura Aromatic Bitters', 'Bitters'], 'product')), 'dasher');

// A product is always a bottle or pack, even when its name sounds like fruit.
assert.equal(art(['Cherry Heering'], 'product').kind, 'bottle');
assert.equal(art(['Cherry'], 'generic').kind, 'produce');

// Words inside other words don't count.
assert.equal(kind(art(['Dark Chocolate', 'Chocolate'])), 'bar', '"chocolate" is not cola');
assert.notEqual(kind(art(['Bombay Sapphire', 'London Dry Gin'], 'product')), 'sprig', '"Bombay" is not bay leaf');
assert.equal(kind(art(['Pineapple Juice', 'Pineapple', 'Fruit'])), 'fruit', 'pineapple is not pine');

// Berries, cucumbers and fat washes get their own drawings.
const berry = (n: string) => { const a = art([n, 'Berries']); return a.kind === 'produce' ? a.inputs.berry : null; };
assert.equal(berry('Strawberry'), 'strawberry');
assert.equal(berry('Raspberry'), 'drupe');
assert.equal(berry('Blueberry'), 'round');
const cuke = art(['Cucumber']);
assert.ok(cuke.kind === 'produce' && cuke.inputs.cut);
const fat = art(['Tapenade Fat-Wash', 'Olive']);
assert.ok(fat.kind === 'produce' && fat.inputs.oil, 'a fat wash shows its oil');

// Kitchen things that used to fall through to the syrup bottle.
assert.equal(kind(art(['Shiitake', 'Mushroom'])), 'mushroom');
const chanterelle = art(['Chanterelle Mushrooms', 'Mushroom']);
assert.ok(chanterelle.kind === 'produce' && chanterelle.inputs.cap === 'funnel');
const truffle = art(['Black Truffle', 'Truffle']);
assert.ok(truffle.kind === 'produce' && truffle.inputs.kind === 'root' && truffle.inputs.rough);
assert.equal(kind(art(['Ube'])), 'root');
assert.equal(kind(art(['Kombu', 'Seaweed'])), 'seaweed');
const garlic = art(['Black Garlic', 'Garlic']);
assert.ok(garlic.kind === 'produce' && garlic.inputs.bulb === 'garlic');
assert.equal(kind(art(['Parmesan', 'Dairy'])), 'wedge');
assert.equal(kind(art(['Tabasco', 'Hot Sauce'], 'product')), 'sauce');
assert.equal(kind(art(['Mushroom Caramel', 'Caramel'])), 'jar', 'what it is beats what it is made of');
assert.equal(kind(art(['Macallan 12 Double Oak', 'Oak'], 'product')), 'tall', 'a whisky is not a pile of wood');
assert.equal(kind(art(['Cranberry Sauce', 'Cranberry'])), 'berries', 'new rules only catch what nothing else knows');

// Roasted and black teas are brown, only green teas are green.
const leaf = (names: string[]) => { const a = art(names); return a.kind === 'produce' ? a.inputs.color : null; };
assert.equal(leaf(['Hojicha', 'Green Tea', 'Tea']), PANTRY.hojicha, 'hojicha is roasted, so brown');
assert.equal(leaf(['Hoji Tea', 'Tea']), PANTRY.hojicha);
assert.equal(leaf(['Earl Grey', 'Black Tea', 'Tea']), PANTRY.blackTea);
assert.equal(leaf(['Sencha', 'Green Tea', 'Tea']), PANTRY.tea);
const hojiSyrup = art(['Hojicha Syrup', 'Syrup']);
assert.ok(hojiSyrup.kind === 'bottle' && hojiSyrup.inputs.liquid.hex === PANTRY.hojicha);

// Unknown things still get a drawing, and the same ingredient always the same one.
assert.equal(kind(art(['Kleos'], null)), 'apothecary');
assert.deepEqual(ingredientArt(['Brugal Extra Dry', 'White Rum'], 'product', 'x'), ingredientArt(['Brugal Extra Dry', 'White Rum'], 'product', 'x'));

// Every drawing paints at both sizes.
for (const names of [['Lime'], ['Raspberry', 'Berries'], ['Strawberry'], ['Cucumber'], ['Coffee'], ['Mint'], ['Hibiscus'], ['Egg White', 'Egg'], ['Honey'], ['Heavy Cream', 'Cream'], ['Tapenade Fat-Wash', 'Olive'], ['Cola'], ['Lager', 'Beer'], ['Porcini'], ['Chanterelle'], ['Black Truffle'], ['Potato'], ['Onion'], ['Garlic'], ['Spring Onion'], ['Kombu'], ['Parmesan'], ['Soy Sauce']]) {
  const a = art(names);
  for (const detail of ['full', 'thumb'] as const) {
    const scene = a.kind === 'bottle' ? paintBottle(a.inputs, { seed: names[0], detail }) : paintProduce(a.inputs, { seed: names[0], detail });
    assert.ok(scene.els.length > 5, `${names[0]} (${detail}) draws something`);
    assert.ok(!JSON.stringify(scene).includes('NaN'), `${names[0]} (${detail}) has no NaN`);
  }
}

console.log('ingredientArt: ok');
