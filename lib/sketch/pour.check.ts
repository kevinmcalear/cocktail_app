import assert from 'node:assert/strict';

import { pourSketch, wineStyle } from './pour';

assert.equal(wineStyle('Yarra Valley Pinot Noir'), 'red wine');
assert.equal(wineStyle('Clare Riesling'), 'white wine');
assert.equal(wineStyle('Etna Rosso'), 'red wine');
assert.equal(wineStyle('Grower Champagne'), 'sparkling wine');
assert.equal(wineStyle('Provence Rosé'), 'rosé');
assert.equal(wineStyle('Skin Contact Pinot Gris'), 'orange wine');

const lager = pourSketch('Beer', 'Little Rye Lager');
assert.equal(lager.glass, 'beer');
assert.ok(lager.fizz, 'beer is fizzy');
assert.equal(lager.ice, 'none');
const stout = pourSketch('Beer', 'Dry Stout');
assert.ok(stout.liquid.alpha > lager.liquid.alpha, 'a stout pours darker than a lager');
assert.equal(pourSketch('Wine', 'Barossa Shiraz').glass, 'wine');
assert.equal(pourSketch('Wine', 'NV Prosecco').glass, 'flute');
assert.notEqual(pourSketch('Wine', 'Barossa Shiraz').liquid.hex, pourSketch('Wine', 'Clare Riesling').liquid.hex);
