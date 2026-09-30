// Checks for lib/service.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { bottleLine, isAtStation, isServiceStyle, serviceSpec, serviceStyleLabel, stationCard } from './service';
import { specLines } from './spec';

const row = (id: string, name: string, amount: number | null, unit: string | null, at_service: boolean | null = null) => ({
  id,
  amount,
  unit,
  at_service,
  display_ingredient_id: id,
  display_ingredient: { id, name },
});

// Nobody has decided: the name-matching guess splits it, and says so.
const guessed = serviceSpec(specLines([row('rum', 'White rum', 60, 'ml'), row('lime', 'Lime juice', 22.5, 'ml'), row('syr', 'Simple syrup', 15, 'ml'), row('tw', 'Lime', 1, 'wheel')]));
assert.deepEqual(guessed.batch.map((l) => l.ingredient), ['White rum', 'Simple syrup']);
assert.deepEqual(guessed.station.map((l) => l.ingredient), ['Lime juice', 'Lime']);
assert.ok(guessed.allGuessed && guessed.batch.every((l) => l.guessed));
assert.equal(guessed.pour, '75 ml');
assert.deepEqual(guessed.servesPerBottle, { ml750: 10, l1: 13 });
assert.equal(bottleLine(guessed), 'A 750 ml bottle is 10 serves');
assert.equal(guessed.station[1].garnish, true);

// The bar decided: the batch holds rum and syrup as before, but now the lime
// too (a bottled daiquiri), and the garnish is the only station line.
const decided = serviceSpec(
  specLines([row('rum', 'White rum', 60, 'ml', false), row('lime', 'Lime juice', 22.5, 'ml', false), row('syr', 'Simple syrup', 15, 'ml', false), row('tw', 'Lime', 1, 'wheel', true)])
);
assert.deepEqual(decided.batch.map((l) => l.ingredient), ['White rum', 'Lime juice', 'Simple syrup']);
assert.equal(decided.pour, '97.5 ml');
assert.equal(decided.allGuessed, false);
assert.equal(decided.batch[0].guessed, false);

// Weighed lines add up in grams next to the ml.
const weighed = serviceSpec(specLines([row('rum', 'White rum', 50, 'g', false), row('syr', 'Syrup', 17.5, 'g', false), row('lime', 'Lime juice', 24, 'ml', true)]));
assert.equal(weighed.pour, '67.5 g');
assert.equal(weighed.pourMl, null);
assert.equal(weighed.servesPerBottle, null, 'no bottle count without a volume');
const mixed = serviceSpec(specLines([row('a', 'Gin', 60, 'ml', false), row('b', 'Salt', 1, 'g', false)]));
assert.equal(mixed.pour, '60 ml + 1 g');

// Locked amounts: the lines still split, without numbers.
const locked = serviceSpec(specLines([row('rum', 'White rum', null, null), row('lime', 'Lime juice', null, null)]));
assert.equal(locked.pour, null);
assert.equal(locked.batch[0].amount, '');
assert.equal(isAtStation(specLines([row('x', 'Lemon juice', null, null, false)])[0]), false, 'a decision holds without an amount');

// The station card.
const daiquiri = specLines([row('rum', 'Daiquiri batch', 67, 'ml', false), row('lime', 'Lime juice', 24, 'ml', true), row('tw', 'Lime', 1, 'wheel', true)]);
const card = stationCard({ id: 'd', name: 'Daiquiri', style: 'batched', method: 'Shake', glass: 'Coupe', ice: null }, daiquiri);
assert.equal(card.how, 'Shake · Coupe');
assert.equal(card.pour, '67 ml batch');
assert.deepEqual(card.adds, ['24 ml Lime juice']);
assert.deepEqual(card.garnish, ['1 wheel Lime']);
const martini = stationCard(
  { id: 'm', name: 'Freezer Martini', style: 'bottled', method: 'Pour', glass: 'Nick & Nora', ice: 'None' },
  specLines([row('g', 'Gin', 75, 'ml', false), row('v', 'Vermouth', 15, 'ml', false), row('w', 'Water', 18, 'ml', false)])
);
assert.equal(martini.pour, '108 ml from the bottle');
assert.deepEqual(martini.adds, []);
const fresh = stationCard({ id: 'f', name: 'Sour', style: null, method: null, glass: null, ice: null }, specLines([row('l', 'Lemon juice', 25, 'ml'), row('e', 'Egg white', 1, 'each')]));
assert.equal(fresh.pour, null, 'nothing batched, nothing to pour');
assert.equal(fresh.how, '');
assert.equal(stationCard({ id: 'x', name: 'X', style: 'batched', method: null, glass: null, ice: null }, specLines([row('g', 'Gin', 60, 'ml', false)])).pour, '60 ml batch, nothing added');

assert.equal(serviceStyleLabel('a_la_minute'), 'À la minute');
assert.equal(serviceStyleLabel('nope'), null);
assert.ok(isServiceStyle('draught') && !isServiceStyle('keg'));

console.log('service: ok');
