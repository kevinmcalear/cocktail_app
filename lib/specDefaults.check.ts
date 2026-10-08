import assert from 'node:assert/strict';

import { fixesFor, balanceOf } from './balance';
import { serveGuess, suggestAmount, tidyAmount } from './specDefaults';
import { capitalizeFirsts } from './stringUtils';

const l = (name: string) => ({ name });

// A base spirit starts at a full pour; a second one splits it.
assert.equal(suggestAmount(l('Gin'), 'ml'), '60');
assert.equal(suggestAmount(l('White Rum'), 'oz'), '2');
assert.equal(suggestAmount(l('Mezcal'), 'ml', [l('Tequila')]), '30');
// Citrus, syrup with citrus, and without.
assert.equal(suggestAmount(l('Lime Juice'), 'ml'), '22.5');
assert.equal(suggestAmount(l('Lime Juice'), 'oz'), '0.75');
assert.equal(suggestAmount(l('Simple Syrup'), 'ml', [l('Lime Juice')]), '22.5');
assert.equal(suggestAmount(l('Rich Simple Syrup'), 'ml', [l('Lemon Juice')]), '15');
assert.equal(suggestAmount(l('Simple Syrup'), 'ml', [l('Rye Whiskey')]), '7.5');
// Vermouth and Campari are an ounce; a liqueur three quarters; absinthe a rinse.
assert.equal(suggestAmount(l('Sweet Vermouth'), 'oz'), '1');
assert.equal(suggestAmount(l('Campari'), 'ml'), '30');
assert.equal(suggestAmount(l('Cointreau'), 'cl'), '2.25');
assert.equal(suggestAmount(l('Absinthe'), 'ml'), '7.5');
// Units that count, a top, and a name nobody knows.
assert.equal(suggestAmount(l('Angostura Bitters'), 'dash'), '2');
assert.equal(suggestAmount(l('Egg White'), 'each'), '1');
assert.equal(suggestAmount(l('Soda Water'), 'top'), '');
assert.equal(suggestAmount(l('Grandma’s Thing'), 'ml'), '');

// Fractions and commas, as people type them.
assert.equal(tidyAmount('3/4'), '0.75');
assert.equal(tidyAmount('1 1/2'), '1.5');
assert.equal(tidyAmount('1½'), '1.5');
assert.equal(tidyAmount('¾'), '0.75');
assert.equal(tidyAmount('22,5'), '22.5');
assert.equal(tidyAmount(' 30 '), '30');
assert.equal(tidyAmount(''), '');
assert.equal(tidyAmount('a splash'), 'a splash');

// Serving: citrus is shaken into a coupe; a topped drink is built; picks aren't guessed over.
const sour = serveGuess({ name: 'House special', lines: [{ name: 'Gin', amount: 60, unit: 'ml' }, { name: 'Lemon Juice', amount: 22.5, unit: 'ml' }, { name: 'Simple Syrup', amount: 22.5, unit: 'ml' }] });
assert.equal(sour.method, 'Shake');
assert.equal(sour.glass, 'Coupe');
assert.equal(sour.ice, 'No ice');
assert.match(sour.why ?? '', /shaken/);
const stirred = serveGuess({ name: 'House drink', lines: [{ name: 'Rye Whiskey', amount: 60, unit: 'ml' }, { name: 'Sweet Vermouth', amount: 30, unit: 'ml' }] });
assert.equal(stirred.method, 'Stir');
const picked = serveGuess({ name: 'House sour', methods: ['Stir'], glass: 'Rocks', lines: [{ name: 'Gin', amount: 60, unit: 'ml' }] });
assert.equal(picked.method, null, 'a picked method is not guessed');
assert.equal(picked.glass, null);
assert.equal(serveGuess({ name: 'Empty', lines: [] }).method, null);

// Balance fixes follow the base spirit and skip what's in it already.
const mezcalSour = [{ name: 'Mezcal', amount: 45, unit: 'ml' }, { name: 'Lime Juice', amount: 22.5, unit: 'ml' }];
assert.equal(balanceOf(mezcalSour)?.need, 'sweet');
assert.deepEqual(fixesFor('sweet', mezcalSour), ['Agave syrup', 'Orange liqueur']);
assert.deepEqual(fixesFor('body', [{ name: 'Rye Whiskey' }, { name: 'Angostura Bitters' }]), ['Sweet vermouth']);
assert.deepEqual(fixesFor('sweet', [{ name: 'Mystery' }]), ['Simple syrup']);

// A name can decide the method; then there's no reason from the spec to give.
const named = serveGuess({ name: 'House Negroni', lines: [{ name: 'Tequila', amount: 60, unit: 'ml' }, { name: 'Lime Juice', amount: 22.5, unit: 'ml' }] });
assert.equal(named.method, 'Stir');
assert.equal(named.why, null);

// Names from a catalog or label keep their own capitals.
assert.equal(capitalizeFirsts(' brewDog punk IPA '), 'BrewDog Punk IPA');
assert.equal(capitalizeFirsts('st-germain'), 'St-Germain');
