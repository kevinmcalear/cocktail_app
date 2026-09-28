// Checks for lib/classics.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { matchKey, suggestClassic } from './classics';

const CLASSICS = [
  'Martini', 'Negroni', 'Old Fashioned', 'Manhattan', 'Daiquiri', 'Margarita', 'Sazerac', 'Boulevardier', 'Aviation',
  'Corpse Reviver #2', 'Vieux Carré', "Tommy's Margarita", 'White Negroni', 'Espresso Martini', 'Americano', 'Brooklyn',
  'Whiskey Sour', 'Piña Colada',
].map((name, i) => ({ id: String(i), name }));

function suggest(name: string): string | null {
  const m = suggestClassic(name, CLASSICS);
  return m ? `${m.classic.name}${m.exact ? '' : ' ?'}` : null;
}

// --- matchKey ---
assert.equal(matchKey('Vieux Carré (Ours)'), 'vieux carre');
assert.equal(matchKey("Tommy's Margarita"), 'tommys margarita');
assert.equal(matchKey('Arsenic & Old Lace'), 'arsenic and old lace');

// --- Same name, once house notes, numbering, case and accents are set aside ---
// Real names from production menus.
assert.equal(suggest('Martini (Ford)'), 'Martini');
assert.equal(suggest('Old Fashioned (House)'), 'Old Fashioned');
assert.equal(suggest('Sazerac (New Orleans)'), 'Sazerac');
assert.equal(suggest('Daiquiri #4'), 'Daiquiri');
assert.equal(suggest('Aviation 1'), 'Aviation');
assert.equal(suggest('vieux carre'), 'Vieux Carré');
assert.equal(suggest('Tommys Margarita'), "Tommy's Margarita");
assert.equal(suggest('White Negroni\n'), 'White Negroni');
assert.equal(suggest('Corpse Reviver #2'), 'Corpse Reviver #2');
assert.equal(suggest('Americano (Everleigh)'), 'Americano');
assert.equal(suggest('Whisky Sour'), 'Whiskey Sour');
assert.equal(suggest('Pina Colada'), 'Piña Colada');

// --- Misspellings from real menus ---
assert.equal(suggest('Boulvardier'), 'Boulevardier');
assert.equal(suggestClassic('Pompiere', [{ id: 'p', name: 'Pompier' }])?.classic.name, 'Pompier');

// --- Contains a classic's name: a suggestion, never exact; the longest wins ---
assert.equal(suggest('Mega Negroni'), 'Negroni ?');
assert.equal(suggest('Manhattan Harrys'), 'Manhattan ?');
assert.equal(suggest('Margarita Attaboy'), 'Margarita ?');
assert.equal(suggest('Vodka Martini'), 'Martini ?');
assert.equal(suggest('Smoked Espresso Martini'), 'Espresso Martini ?');

// --- Different drinks that only look alike ---
assert.equal(suggest('Corpse Reviver #1'), null, 'a different number is a different drink');
assert.equal(suggest('Brooklynite'), null, 'whole words only');
assert.equal(suggest('Whisky Business'), null);
assert.equal(suggest(''), null);
assert.equal(suggest('(house)'), null);

console.log('classics: ok');
