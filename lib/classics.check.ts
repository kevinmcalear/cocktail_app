// Checks for lib/classics.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { matchKey, suggestClassic } from './classics';

const CLASSICS = [
  'Martini', 'Negroni', 'Old Fashioned', 'Manhattan', 'Daiquiri', 'Margarita', 'Sazerac', 'Boulevardier', 'Aviation',
  'Corpse Reviver #2', 'Vieux Carré', "Tommy's Margarita", 'White Negroni', 'Espresso Martini', 'Americano', 'Brooklyn',
  'Whiskey Sour', 'Piña Colada', 'Japanese Cocktail', 'Greenpoint', "Corn 'n' Oil", 'Champs-Élysées', 'Caipiroska',
  'De La Louisiane', 'Bronx', 'Champagne Cocktail',
].map((name, i) => ({ id: String(i), name }));

function suggest(name: string): string | null {
  const m = suggestClassic(name, CLASSICS);
  return m ? `${m.classic.name}${m.exact ? '' : ' ?'}` : null;
}

// --- matchKey ---
assert.equal(matchKey('Vieux Carré (Ours)'), 'vieux carre');
assert.equal(matchKey("Tommy's Margarita"), 'tommys margarita');
assert.equal(matchKey('Arsenic & Old Lace'), 'arsenic and old lace');
assert.equal(matchKey("Corn 'n' Oil"), 'corn and oil');

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

// --- Old menus' spellings of the same drink (a venue's import, E50, 26 Oct 2026) ---
assert.equal(suggest('Americano Cocktail'), 'Americano', 'a "Cocktail" the menu added is the same drink');
assert.equal(suggest('Japanese'), 'Japanese Cocktail ?', 'the classic\'s own "Cocktail" left off: a guess');
assert.equal(suggest('Champagne'), 'Champagne Cocktail ?', 'a bare "Champagne" may be the wine');
assert.equal(suggest('Green Point'), 'Greenpoint', 'spacing');
assert.equal(suggest('Corpse Reviver No. 2'), 'Corpse Reviver #2');
assert.equal(suggest('Corn And Oil'), "Corn 'n' Oil");
assert.equal(suggest('A La Louisiane'), 'De La Louisiane', 'its other name');

// --- The same venue's pre-war classics, seeded in 20261121500000 ---
const OLD = ['Astoria', 'Astor Hotel Special', 'Coo-ee Special', 'Pan American Clipper', 'Turf'].map((name, i) => ({ id: String(i), name }));
const old = (name: string) => suggestClassic(name, OLD)?.classic.name;
assert.equal(old('Astoria Hotel Special'), 'Astor Hotel Special', 'a misspelling, not the Astoria');
assert.equal(old('Coo-wee!'), 'Coo-ee Special');
assert.equal(old('Pan Am Clipper'), 'Pan American Clipper');
assert.equal(old('Turf Club'), 'Turf', 'the name McElhone printed it under');

// --- A letter or two off: a guess, never exact ---
assert.equal(suggest('Champs Elysses'), 'Champs-Élysées ?');
assert.equal(suggest('Caiprioska'), 'Caipiroska ?');
assert.equal(suggest('Negronni'), 'Negroni ?');
assert.equal(suggest('Sazarac'), 'Sazerac ?');

// --- Contains a classic's name: a suggestion, never exact; the longest wins ---
assert.equal(suggest('Mega Negroni'), 'Negroni ?');
assert.equal(suggest('Manhattan Harrys'), 'Manhattan ?');
assert.equal(suggest('Margarita Attaboy'), 'Margarita ?');
assert.equal(suggest('Vodka Martini'), 'Martini ?');
assert.equal(suggest('Smoked Espresso Martini'), 'Espresso Martini ?');

// --- Different drinks that only look alike ---
assert.equal(suggest('Corpse Reviver #1'), null, 'a different number is a different drink');
assert.equal(suggest('Brooklynite'), null, 'whole words only');
assert.equal(suggest('Corpse Reviver #3'), null, 'a slip never changes the number');
assert.equal(suggest('Brons'), null, 'short names need it exact');
assert.equal(suggestClassic('Frisco Sour', [{ id: 'p', name: 'Pisco Sour' }]), null, 'a slip never changes the first letter');
assert.equal(suggest('Allies Cocktail'), null, 'not in the catalog');
assert.equal(suggest('Whisky Business'), null);
assert.equal(suggest(''), null);
assert.equal(suggest('(house)'), null);

console.log('classics: ok');
