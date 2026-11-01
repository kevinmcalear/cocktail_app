// Checks for lib/paletteRows.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { learnTitle, madeFirst, usedFor } from './paletteRows';

// --- which add leads (Prod-desk-cmdk: "grenad" finds the house-made, so it offers a new house-made) ---
const grenadine = { name: 'Grenadine' };
const jackRose = { name: 'Jack Rose', recipes: [{ ingredient: { name: 'Applejack' } }, { ingredient: { name: 'Grenadine' } }] };
assert.equal(madeFirst({ ingredients: [grenadine], drinks: [jackRose] }, 'grenad'), true);
assert.equal(madeFirst({ ingredients: [], drinks: [jackRose] }, 'grenad'), false, 'no ingredient: a drink leads');
assert.equal(madeFirst({ ingredients: [{ name: 'Negroni bianco cordial' }], drinks: [{ name: 'Negroni' }] }, 'negr'), false, 'a drink starting the word wins');
assert.equal(madeFirst({ ingredients: [grenadine], drinks: [] }, '  '), false);

// --- why a drink is here ---
assert.equal(usedFor(jackRose, 'grenad'), 'Grenadine');
assert.equal(usedFor(jackRose, 'jack'), null, 'found by its own name');
assert.equal(usedFor({ name: 'Daiquiri' }, 'grenad'), null);
assert.equal(usedFor({ name: 'Ward Eight', recipes: [{ ingredient: null }, { ingredient: { name: 'Grenadine' } }] }, 'GRÉNAD'), 'Grenadine', 'case and accents aside');

// --- Learn's titles ---
assert.equal(learnTitle({ name: 'Grenadine' }), 'How to make grenadine');
assert.equal(learnTitle({ name: 'Dry shake', method: true }), 'Dry shake');

console.log('paletteRows: ok');
