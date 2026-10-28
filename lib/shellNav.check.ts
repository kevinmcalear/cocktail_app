// Checks for lib/shellNav.ts and the web nav breakpoints. Run: npm run test:unit
import assert from 'node:assert/strict';

import { backBarLine, collectionLine, featuresLine, footerLine, menusLine, navCurrent, shelfLine, shortPersonName, teamLine, webNavFor, type NavMatch } from './shellNav';

const rows: NavMatch[] = [
  { key: 'index', path: '/' },
  { key: 'library', path: '/library' },
  { key: 'menus', path: '/menus/all', prefix: '/menus' },
  { key: 'brand', path: '/settings/bar/b1/brand' },
  { key: 'venue', path: '/settings/bar/b1' },
];

// A row's own path, and paths under a prefix.
assert.equal(navCurrent('/', rows, null), 'index');
assert.equal(navCurrent('/library', rows, 'index'), 'library');
assert.equal(navCurrent('/menus/abc/edit', rows, null), 'menus');
assert.equal(navCurrent('/menus', rows, null), 'menus');
assert.equal(navCurrent('/menusx', rows, null), null);
// Brand is its own row, not Venue settings.
assert.equal(navCurrent('/settings/bar/b1/brand', rows, null), 'brand');
assert.equal(navCurrent('/settings/bar/b1', rows, null), 'venue');
// The add wizard keeps Library lit; a stale key from the other mode doesn't stick.
assert.equal(navCurrent('/add-cocktail', rows, 'library'), 'library');
assert.equal(navCurrent('/add-cocktail', rows, 'collection'), null);
assert.equal(navCurrent('/add-cocktail', rows, null), null);

assert.equal(shortPersonName('Kevin McAlear'), 'Kevin M.');
assert.equal(shortPersonName('  jo  van  park '), 'jo P.');
assert.equal(shortPersonName('Cher'), 'Cher');
assert.equal(shortPersonName(''), 'You');
assert.equal(shortPersonName(null), 'You');

assert.equal(footerLine({ name: 'Little Rye', role: 'Admin' }, 12), 'Admin at Little Rye');
assert.equal(footerLine(null, 46), 'Home bar · 46 bottles');
assert.equal(footerLine(null, 1), 'Home bar · 1 bottle');
assert.equal(footerLine(null, null), 'Home bar');
assert.equal(footerLine(null, 0), 'Home bar');

assert.equal(menusLine(1, 2), '1 on');
assert.equal(menusLine(0, 1), '1 draft');
assert.equal(menusLine(0, 0), '');
assert.equal(featuresLine(2, 8), '2 of 8 on');
assert.equal(featuresLine(0, 8), '');
assert.equal(backBarLine(84, 3), '3 waiting');
assert.equal(backBarLine(84, 0), '84 placed');
assert.equal(backBarLine(0, 0), '');
assert.equal(teamLine(9, 2), '9 people · 2 invited');
assert.equal(teamLine(1, 0), '1 person');
assert.equal(shelfLine(4), '4 bottles');
assert.equal(shelfLine(1), '1 bottle');
assert.equal(shelfLine(0), '');
assert.equal(collectionLine(12), '12 to make');
assert.equal(collectionLine(0), '');

// Phones and native get the tab bar; 768 to 1199 the rail; 1200 and up the sidebar.
assert.equal(webNavFor('ios', 1400), 'tabs');
assert.equal(webNavFor('ios', 1024, true), 'rail', 'a native iPad gets the rail like tablet web');
assert.equal(webNavFor('ios', 1376, true), 'sidebar');
assert.equal(webNavFor('ios', 700, true), 'tabs', 'an iPad in a narrow split keeps the tab bar');
assert.equal(webNavFor('web', 390), 'tabs');
assert.equal(webNavFor('web', 767), 'tabs');
assert.equal(webNavFor('web', 768), 'rail');
assert.equal(webNavFor('web', 1199), 'rail');
assert.equal(webNavFor('web', 1200), 'sidebar');

console.log('shellNav checks passed');
