import assert from 'node:assert/strict';

import {
  BEER_WINE_COPY, beerWineSketch, savedSketch, EMPTY_BEER_WINE, fillFromCatalog, fillFromLabel, fullDescription, guessStyle, REGIONS, stepAbv, stepsFor, startingAbv,
  STYLES, tastingLine, stepEyebrow, glassChoices, cleanPrice, takenWords, drawnSoFar,
} from './beerWineWizard';
import { variantsOf } from './sketch/geometry';
import { readSketchInputs } from './sketch/types';

// The price is a venue's step only.
assert.ok(stepsFor(true).includes('price'));
assert.ok(!stepsFor(false).includes('price'));
for (const kind of ['beer', 'wine'] as const) for (const step of stepsFor(true)) assert.ok(BEER_WINE_COPY[kind][step].title, `${kind} ${step} has copy`);

// Every style's usual glass is a real drawing, and every drawing reads back as valid inputs.
for (const kind of ['beer', 'wine'] as const) {
  for (const style of STYLES[kind]) {
    const inputs = beerWineSketch(kind, { style: style.name, glassVariant: null });
    assert.ok(variantsOf(inputs.glass).some((v) => v.key === style.variant), `${style.name}: ${style.variant} is a ${inputs.glass} drawing`);
    assert.equal(inputs.variant, style.variant);
    assert.deepEqual(readSketchInputs(inputs), inputs, `${style.name} draws`);
  }
}
// A stout is dark with a creamy head; sparkling wine is in a flute with bubbles; a picked shape wins.
const stout = beerWineSketch('beer', { style: 'Stout', glassVariant: null });
assert.equal(stout.foam, 'crema');
const fizz = beerWineSketch('wine', { style: 'Sparkling', glassVariant: null });
assert.equal(fizz.glass, 'flute');
assert.ok(fizz.fizz);
assert.equal(beerWineSketch('beer', { style: 'IPA', glassVariant: 'beer_tankard' }).variant, 'beer_tankard');
assert.equal(beerWineSketch('wine', { style: 'Sparkling', glassVariant: 'wine_bordeaux' }).variant, 'flute_tulip', 'a shape for another glass is ignored');

// Styles from what labels say.
assert.equal(guessStyle('beer', 'Hazy India Pale Ale'), 'IPA');
assert.equal(guessStyle('beer', 'Munich helles'), 'Lager');
assert.equal(guessStyle('wine', 'Marlborough Sauvignon Blanc'), 'White');
assert.equal(guessStyle('wine', 'Brut Champagne'), 'Sparkling');
assert.equal(guessStyle('wine', 'Something'), null);

// Strength: the style's usual first; the stepper walks tenths.
assert.equal(startingAbv('beer', 'IPA'), 6.5);
assert.equal(startingAbv('wine', null), 12.5);

// Each step says where it is (Add-beer: "BEER · 1 OF 7"); at home there's one step fewer.
assert.equal(stepEyebrow('beer', 'name', stepsFor(true)), 'Beer · 1 of 7');
assert.equal(stepEyebrow('wine', 'notes', stepsFor(false)), 'Wine · 6 of 6');
assert.equal(stepEyebrow('beer', 'review', stepsFor(true)), 'Beer · review');

// The glass step: the style's usual glass first, said as a glass; every glass of its kind offered once.
const pils = glassChoices('beer', 'Pilsner');
assert.deepEqual(pils[0], { key: 'beer_pilsner', label: 'Pilsner glass · usual' });
assert.equal(new Set(pils.map((g) => g.key)).size, variantsOf('beer').length);
assert.ok(!glassChoices('beer', null)[0].label.includes('usual'), 'no style, no usual');
assert.equal(glassChoices('wine', 'Sparkling')[0].key, 'flute_tulip');

// The wizard's glass is empty until a style colours it.
// Alpha 0 is paint's bare glass (lib/sketch/paint.ts); it is drawn live, never stored, so readSketchInputs' 0.05 floor doesn't apply.
assert.equal(drawnSoFar('beer', { style: null, glassVariant: null }).liquid.alpha, 0);
assert.equal(drawnSoFar('wine', { style: null, glassVariant: null }).foam, null);
assert.equal(drawnSoFar('beer', { style: 'Stout', glassVariant: null }).foam, 'crema');

// The name-taken card says when it was added and which menu it's on.
assert.deepEqual(takenWords('Pilsner Urquell', true, '2026-09-14T12:00:00Z', 'Autumn'), {
  title: 'Pilsner Urquell is already on the list',
  body: 'Added in September, on the Autumn menu. Open that one, or name this one so they’re told apart (a vintage, a size).',
});
assert.equal(takenWords('Pils', true, '2026-09-14T12:00:00Z', 'Spring menu').body.split('.')[0], 'Added in September, on the Spring menu');
assert.equal(takenWords('Pils', false, null, null).title, 'Pils is already on your shelf');
assert.equal(takenWords('Pils', false, null, null).body, 'Open that one, or name this one so they’re told apart (a vintage, a size).');

// A beer's price is a number; a wine's says how it's sold, as typed.
assert.equal(cleanPrice('beer', '$9 a pint'), '9');
assert.equal(cleanPrice('wine', '18 a glass · 72 a bottle'), '18 a glass · 72 a bottle');
assert.equal(stepAbv('', 1, 5), '5');
assert.equal(stepAbv('4.9', 1, 5), '5');
assert.equal(stepAbv('0', -1, 5), '0');

// Tasting words lead the description.
assert.equal(tastingLine(['Crisp', 'Hoppy', 'Dry']), 'Crisp, hoppy and dry.');
assert.equal(tastingLine(['Bold']), 'Bold.');
assert.equal(fullDescription({ ...EMPTY_BEER_WINE, tasting: ['Crisp'], description: ' Great with oysters. ' }), 'Crisp. Great with oysters.');
assert.equal(fullDescription(EMPTY_BEER_WINE), '');

// The catalog fills what's empty and keeps what's typed.
const filled = fillFromCatalog('beer', { ...EMPTY_BEER_WINE, name: 'Punk', abv: '5.6' }, {
  id: 'b1', name: 'BrewDog Punk IPA', brand_maker: 'BrewDog', abv: 5.4, description: 'Scottish IPA.', origin: 'UK', categories: ['IPA', 'UK'],
});
assert.deepEqual(filled, { maker: 'BrewDog', abv: '5.6', style: 'IPA', region: 'UK', description: 'Scottish IPA.', origin: 'UK' });
assert.ok(REGIONS.beer.includes('UK'));

// A label fills the name only when none is typed.
assert.deepEqual(fillFromLabel('wine', EMPTY_BEER_WINE, { brand: 'Cloudy Bay', name: 'Cloudy Bay Sauvignon Blanc', kind: 'White wine', abv: 13 }), {
  name: 'Cloudy Bay Sauvignon Blanc', maker: 'Cloudy Bay', abv: '13', style: 'White',
});
assert.equal(fillFromLabel('beer', { ...EMPTY_BEER_WINE, name: 'House pils' }, { brand: null, name: 'X', kind: null, abv: null }).name, 'House pils');

// A catalog entry with no region tag takes it from where it's from.
assert.equal(fillFromCatalog('beer', EMPTY_BEER_WINE, { id: 'b2', name: 'Brooklyn Lager', brand_maker: 'Brooklyn', abv: 5.2, description: null, origin: 'Brooklyn, USA', categories: [] }).region, 'USA');
// A saved one's page draws it the same: style from its tags, its saved glass.
assert.deepEqual(savedSketch('beer', ['UK', 'IPA'], 'beer_tulip'), beerWineSketch('beer', { style: 'IPA', glassVariant: 'beer_tulip' }));

console.log('beer and wine wizard: ok');
