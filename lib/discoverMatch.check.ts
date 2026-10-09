// Checks for lib/discoverMatch.ts. Run: npm run test:unit
// Which part matched is SQL: supabase/tests/discover-index.test.mjs.
import assert from 'node:assert/strict';

import type { MapPin } from './discoverMap';
import { pinDescription, pinLook } from './discoverMap';
import { barSearchHref, isStrong, matchWhy, namePins, pinName, snippet, toMatch } from './discoverMatch';

// Rows: an older server sends no match; an unknown kind is ignored.
assert.equal(toMatch(undefined, undefined), null);
assert.equal(toMatch('colour', 'red'), null);
assert.deepEqual(toMatch('riff', 'Martini'), { kind: 'riff', text: 'Martini' });

// Strong matches need no reason; the rest say why.
assert.equal(isStrong(null), true, 'no search');
assert.equal(isStrong({ kind: 'name', text: null }), true);
assert.equal(isStrong({ kind: 'riff', text: 'Martini' }), true);
assert.equal(isStrong({ kind: 'line', text: 'Martini Rosso' }), false);
assert.equal(matchWhy({ kind: 'name', text: null }, null, 'martini'), null);
assert.equal(matchWhy({ kind: 'riff', text: 'Martini' }, null, 'martini'), 'Riff on a Martini');
assert.equal(matchWhy({ kind: 'riff', text: 'Old Fashioned' }, null, 'old fashioned'), 'Riff on an Old Fashioned');
assert.equal(matchWhy({ kind: 'line', text: 'Martini Rosso' }, null, 'martini'), 'Has Martini Rosso');
assert.equal(matchWhy({ kind: 'bar', text: null }, null, 'rye'), "Matched the bar's name");
assert.equal(matchWhy({ kind: 'description', text: null }, null, 'martini'), 'In its description');

// A description snippet: around the first word, cut at spaces, with ellipses where it was cut.
const long = 'Our house pour for the cold months, a dirtier take on the classic martini with olive brine and a long lemon twist.';
const cut = snippet(long, 'martini')!;
assert.ok(cut.includes('classic martini'), cut);
assert.ok(cut.startsWith('…') && cut.endsWith('…'), cut);
assert.ok(cut.length < long.length);
assert.equal(snippet('A martini.', 'Martini'), 'A martini.', 'short ones whole, any case');
assert.equal(snippet('Nothing to see', 'martini'), null);
assert.equal(snippet('Café martini', 'martini'), 'Café martini', 'an accent folds to one letter');
assert.equal(snippet('Cafe\u0301 martini', 'martini'), null, 'a separate accent mark changes the length: no cut');

// Pins: the best few bars, and the selected one, carry their best drink's name.
const pin = (id: string, drinks: number, extra: Partial<MapPin> = {}): MapPin => ({ id, handle: id, name: id, logo: null, place: '', latitude: 0, longitude: 0, score: null, position: null, rankers: 0, drinks, ...extra });
const pins = [pin('a', 3), pin('b', 1), pin('c', 1), pin('d', 1), pin('e', 2), pin('z', 1, { closed: 'Closed 2019' })];
const drinks = ['a', 'a', 'b', 'c', 'd', 'e', 'z'].map((barId, i) => ({ barId, name: `Drink ${i}` }));
const named = namePins(pins, drinks, 'e');
assert.deepEqual(
  named.map((p) => p.top ?? null),
  ['Drink 0', 'Drink 2', 'Drink 3', null, 'Drink 5', null]
);
assert.equal(pinName('Dirty Martini', 2), 'Dirty Martini +1');
assert.equal(pinName('Smoked Rosemary Olive Oil Martini', 1), 'Smoked Rosemary O…');
const accent = { fill: '#c00', text: '#fff' };
assert.equal(pinLook(named[0], false, accent).label, 'Drink 0 +2');
assert.equal(pinLook(named[3], false, accent).label, '1', 'unnamed pins keep their count');
assert.equal(pinDescription(named[0]), 'a, 3 drinks: Drink 0');

// The bar's page opens on the search.
assert.equal(barSearchHref('little.rye', ' dirty martini '), '/p/little.rye?q=dirty%20martini');
assert.equal(barSearchHref('little.rye', ''), '/p/little.rye');

console.log('discoverMatch checks passed');
