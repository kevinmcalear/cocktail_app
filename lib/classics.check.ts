// Checks for lib/classics.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { matchKey, suggestClassic } from './classics';

// Other names as public.classic_aliases has them.
const OTHER_NAMES: Record<string, string[]> = {
  'De La Louisiane': ['A La Louisiane', 'La Louisiane'],
  'Whiskey Sour': ['Whisky Sour'],
};

const CLASSICS = [
  'Martini', 'Negroni', 'Old Fashioned', 'Manhattan', 'Daiquiri', 'Margarita', 'Sazerac', 'Boulevardier', 'Aviation',
  'Corpse Reviver #2', 'Vieux Carré', "Tommy's Margarita", 'White Negroni', 'Espresso Martini', 'Americano', 'Brooklyn',
  'Whiskey Sour', 'Piña Colada', 'Japanese Cocktail', 'Greenpoint', "Corn 'n' Oil", 'Champs-Élysées', 'Caipiroska',
  'De La Louisiane', 'Bronx', 'Champagne Cocktail',
].map((name, i) => ({ id: String(i), name, aliases: OTHER_NAMES[name] }));

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
const OLD = [
  { id: '0', name: 'Astoria' },
  { id: '1', name: 'Astor Hotel Special' },
  { id: '2', name: 'Coo-ee Special' },
  { id: '3', name: 'Pan American Clipper', aliases: ['Pan Am Clipper'] },
  { id: '4', name: 'Turf', aliases: ['Turf Club'] },
  { id: '5', name: 'Betsy Ross', aliases: ['Betty Ross', 'Betty'] },
  { id: '6', name: 'Ford' },
  { id: '7', name: 'Swan' },
  { id: '8', name: 'Betty' },
];
const old = (name: string) => {
  const m = suggestClassic(name, OLD);
  return m ? `${m.classic.name}${m.exact ? '' : ' ?'}` : null;
};
assert.equal(old('Astoria Hotel Special'), 'Astor Hotel Special', 'a misspelling, not the Astoria');
assert.equal(old('Coo-wee!'), 'Coo-ee Special');
assert.equal(old('Pan Am Clipper'), 'Pan American Clipper', 'an other name from classic_aliases is the same drink');
assert.equal(old('Turf Club'), 'Turf');
assert.equal(old('Betty Ross (House)'), 'Betsy Ross');
assert.equal(old('Betty'), 'Betty', "an other name never shadows a classic with that name");
assert.equal(old('Bennett'), null);

// --- A short name (under six letters) is only ever a whole-name match ---
assert.equal(old('Ford'), 'Ford');
assert.equal(old('Ford Cocktail'), 'Ford');
assert.equal(old('Francis Ford Coppola'), null, 'a short name inside another drink is just a word');
assert.equal(old('Swan Lake'), null);
assert.equal(old('Coole Swan'), null);
assert.equal(suggest('Bronx Terrace'), null, 'not a guess at the Bronx');
assert.equal(suggest('Frozen Negroni'), 'Negroni ?', 'six letters or more still guess');

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
