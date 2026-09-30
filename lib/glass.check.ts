// Checks for lib/glass.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { defaultIcePerServe, formatIce, glassFit, glassSizeLabel, iceForEvent } from './glass';

const coupe = { capacity_ml: 180, iced_capacity_ml: 180 };
const rocks = { capacity_ml: 350, iced_capacity_ml: 200 };
const unknown = { capacity_ml: null, iced_capacity_ml: null };

// A 122 ml daiquiri fits a coupe; a 192 ml serve is over by 12.
assert.deepEqual(glassFit(121.9, coupe, false), { roomMl: 180, fits: true, overMl: 0, label: '180 ml · fits' });
assert.equal(glassFit(192, coupe, false)?.label, '180 ml · over by 12 ml');
// With ice in a rocks glass the liquid has 200 ml; without, 350.
assert.equal(glassFit(140.6, rocks, true)?.label, '200 ml with ice · fits');
assert.equal(glassFit(140.6, rocks, false)?.label, '350 ml · fits');
assert.equal(glassFit(230, rocks, true)?.overMl, 30);
assert.equal(glassFit(140.6, unknown, true), null, 'nothing to check against');
assert.equal(glassFit(null, coupe, false), null);
assert.equal(glassFit(100, { capacity_ml: 180, iced_capacity_ml: null }, true)?.label, '180 ml · fits', 'no iced figure: the capacity stands in');

assert.equal(glassSizeLabel(coupe), '180 ml');
assert.equal(glassSizeLabel(rocks), '350 ml (200 ml with ice)');
assert.equal(glassSizeLabel(unknown), null);

// Ice per serve defaults from the room the ice fills: 150 ml at 0.92 g/ml is 138, to the nearest 5.
assert.equal(defaultIcePerServe(rocks, true), 140);
assert.equal(defaultIcePerServe(rocks, false), null);
assert.equal(defaultIcePerServe(coupe, true), null, 'a coupe has no room for ice');
assert.equal(defaultIcePerServe(unknown, true), null);

assert.equal(formatIce(140), '140 g');
assert.equal(formatIce(38_400), '38 kg');
assert.equal(formatIce(5_600), '5.6 kg');

// An event: 140 serves of each drink.
const ice = iceForEvent(
  [
    { name: 'Penicillin', iceType: 'Cubes', icePerServeG: 140 },
    { name: 'Mai Tai', iceType: 'Crushed', icePerServeG: 180 },
    { name: 'Champ Stamp', iceType: 'Cubes', icePerServeG: 140 },
    { name: 'Martini', iceType: null, icePerServeG: null },
    { name: 'Highball', iceType: null, icePerServeG: 120 },
  ],
  140
);
assert.deepEqual(ice.map((i) => [i.type, formatIce(i.grams)]), [['Cubes', '39 kg'], ['Crushed', '25 kg'], ['Ice', '17 kg']]);
assert.deepEqual(ice[0].forDrinks, ['Penicillin', 'Champ Stamp']);
assert.deepEqual(iceForEvent([{ name: 'Martini', iceType: 'None', icePerServeG: 0 }], 40), []);

console.log('glass: ok');
