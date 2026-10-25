import assert from 'node:assert/strict';

import { barKicker, onNowLine, scoreLine } from './barPreview';

// The bar card's lines (ppl-og-images): "COCKTAIL BAR · FITZROY, MELBOURNE", "On now: …", "9.1 bar score · 212 people ranked".
const drinks = [{ id: 'a', name: 'Smoke & Fig Old Fashioned' }, { id: 'b', name: 'Rye Garden Highball' }, ...Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, name: `D${i}` }))];
assert.equal(barKicker({ type: 'Cocktail bar', locality: 'Fitzroy', city: 'Melbourne' }), 'Cocktail bar · Fitzroy, Melbourne');
assert.equal(barKicker({ type: null, locality: null, city: 'Paris' }), 'Bar · Paris');
assert.equal(onNowLine({ menu: { name: 'Field Notes', drinks } }), 'On now: Field Notes. Smoke & Fig Old Fashioned, Rye Garden Highball and 10 more');
assert.equal(onNowLine({ menu: { name: 'Field Notes', drinks: drinks.slice(0, 2) } }), 'On now: Field Notes. Smoke & Fig Old Fashioned and Rye Garden Highball');
assert.equal(onNowLine({ menu: { name: 'Field Notes', drinks: [] } }), 'On now: Field Notes');
assert.equal(onNowLine({ menu: null }), null);
assert.equal(scoreLine({ score: 9.14, rankers: 212 }), '9.1 bar score · 212 people ranked');
assert.equal(scoreLine({ score: null, rankers: 4 }), null, 'no score until enough people rank');
console.log('barPreview: ok');
