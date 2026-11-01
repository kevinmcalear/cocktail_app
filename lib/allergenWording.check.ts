// Allergen wording is safety copy. Every helper in lib/allergens.ts that
// writes words about a drink is swept over every shape of drink, and none may
// say "no allergens", "none" or anything clean unless the bar has checked the
// drink and every ingredient under it has a list (isClear). The menu page's
// #1050 bug ("No allergens" on an unchecked drink once another is checked) is
// the case this guards. Run: npm run test:unit
import assert from 'node:assert/strict';

import {
  allergenFooter,
  allergenNames,
  allergenRows,
  allergyMatches,
  allergyWarning,
  containsLine,
  fromGuest,
  isClear,
  myAllergiesLine,
  prepAllergenNames,
  staleNote,
  type AllergenRead,
  type DrinkAllergen,
} from './allergens';
import { allergyCopy, allergyCopyFor, mergeAllergies } from './myAllergies';

const CLEAN = /\bno allergens?\b|\bnone\b|\bsafe\b|\ballergen[- ]free\b|\bfree of\b/i;
const CHECKED = '2026-10-12T18:00:00Z';
const now = new Date('2026-11-01T12:00:00Z');

const egg: DrinkAllergen = { allergen: 'eggs', via: [['Egg white']] };
const sulphites: DrinkAllergen = { allergen: 'sulphites', via: [['Dry vermouth'], ['Raspberry syrup', 'Red wine vinegar']] };
const hidden: DrinkAllergen = { allergen: 'milk', via: [[]] };

// Every drink shape: allergens found or not, unchecked ingredients or not, a spec or not, checked by the bar or not.
const shapes: AllergenRead[] = [];
for (const allergens of [[], [egg], [egg, sulphites], [hidden]])
  for (const unchecked of [0, 1, 3])
    for (const lines of [0, 1, 5])
      for (const checked of [null, CHECKED]) shapes.push({ allergens, unchecked, lines, checked });

const words = (d: AllergenRead): string[] => [
  containsLine({ allergens: d.allergens, unchecked: d.unchecked, lines: d.lines, checked: d.checked }),
  allergenNames(d),
  allergenFooter(d, 'Caretaker’s', now),
  allergenFooter(d, 'Caretaker’s', now, true),
  ...allergenRows(d).flatMap((r) => [r.label, r.sub ?? '']),
  ...[['eggs'], ['milk'], ['tree_nuts'], ['eggs', 'sulphites']].flatMap((mine) => {
    const w = allergyWarning(allergyMatches(mine, { allergens: d.allergens, checked_at: d.checked }));
    return w ? [w.title, w.body] : [];
  }),
];

let clean = 0;
for (const d of shapes) {
  const said = words(d).join(' | ');
  if (isClear(d)) {
    clean++;
    assert.match(said, /No allergens/, 'a checked drink with nothing declared and nothing unchecked may say so');
    continue;
  }
  assert.doesNotMatch(said, CLEAN, `reads as clean but isn't: ${JSON.stringify(d)} -> ${said}`);
  if (!d.checked) {
    // The bar hasn't checked it: the page says so and sends the guest to the bartender, never a warning built on an unchecked list.
    assert.ok(allergenRows(d).some((r) => r.warn && r.label === 'Not checked by the bar'), 'an unchecked drink says so in the list');
    assert.equal(allergenFooter(d, 'Caretaker’s', now), 'Ask your bartender about your allergies.');
    assert.equal(allergyMatches(['eggs'], { allergens: d.allergens, checked_at: null }), null);
  }
  if (d.unchecked > 0) assert.ok(allergenRows(d).some((r) => r.warn), 'the unchecked count is always shown');
}
assert.equal(clean, 2, 'only checked, with a spec (1 or 5 lines), nothing unchecked and nothing declared is clear');

// The guest's read goes through the same helpers.
assert.equal(isClear(fromGuest({ item_id: 'x', allergens: [], unchecked: 0, lines: 2, checked_at: null })), false, 'a guest read is clear only once the bar checks it');
assert.equal(isClear(fromGuest({ item_id: 'x', allergens: [], unchecked: 0, lines: 2, checked_at: CHECKED })), true);

// The drawn lines (board Loop-allergy).
const clover: AllergenRead = { allergens: [egg, sulphites], unchecked: 0, lines: 5, checked: CHECKED };
assert.deepEqual(allergenRows(clover), [
  { key: 'eggs', label: 'Eggs', sub: 'Egg white', warn: false },
  { key: 'sulphites', label: 'Sulphites', sub: 'Dry vermouth, Raspberry syrup', warn: false },
]);
assert.deepEqual(allergenRows({ ...clover, checked: null, unchecked: 2 }).at(-1), { key: 'unchecked', label: 'Not checked by the bar', sub: '2 ingredients have no list yet', warn: true });
assert.deepEqual(allergenRows({ ...clover, unchecked: 1 }).at(-1), { key: 'unchecked', label: '1 ingredient has no list yet', sub: null, warn: true });
assert.equal(allergenRows({ ...clover, allergens: [hidden] })[0].sub, null, 'a hidden name is left out, the allergen stays');
assert.equal(allergenFooter(clover, 'Caretaker’s', now), 'Checked by Caretaker’s, 12 October.');
assert.equal(allergenFooter({ ...clover, checked: '2025-12-24T10:00:00Z' }, null, now), 'Checked by the bar, 24 December 2025.');
assert.deepEqual(allergyWarning(allergyMatches(['eggs'], { allergens: clover.allergens, checked_at: CHECKED })), { title: 'Contains eggs, from the egg white', body: 'Tell your bartender.' });
assert.equal(allergyWarning(allergyMatches(['eggs', 'sulphites'], { allergens: clover.allergens, checked_at: CHECKED }))?.title, 'Contains eggs and sulphites, from the egg white, dry vermouth and raspberry syrup');
assert.equal(allergyWarning(allergyMatches(['milk'], { allergens: [hidden], checked_at: CHECKED }))?.title, 'Contains milk', 'a hidden ingredient still names the allergen');
assert.equal(
  allergyWarning(allergyMatches(['sulphites'], { allergens: [{ allergen: 'sulphites', via: [['Dry vermouth'], ['Raspberry syrup', 'Lemon']] }], checked_at: CHECKED }))?.title,
  'Contains sulphites, from the dry vermouth and raspberry syrup',
  'every ingredient it comes through, never just the first',
);
assert.equal(allergyWarning(allergyMatches(['tree_nuts'], { allergens: clover.allergens, checked_at: CHECKED })), null, 'no match: nothing, never a tick');
assert.equal(allergenNames(clover), 'Eggs, Sulphites');

// A prep's label: clean only once every ingredient has a list.
assert.equal(prepAllergenNames({ allergens: [], unchecked: 1, lines: 3 }), 'Allergens not checked');
assert.equal(prepAllergenNames({ allergens: [], unchecked: 0, lines: 3 }), 'No allergens');
assert.equal(prepAllergenNames({ allergens: [], unchecked: 0, lines: 0 }), 'Allergens not checked', 'no recipe, nothing to vouch for');
assert.equal(prepAllergenNames({ allergens: [egg], unchecked: 2, lines: 3 }), 'Eggs');

assert.equal(myAllergiesLine(null), 'Not set');
assert.equal(myAllergiesLine([]), 'None');
assert.equal(myAllergiesLine(['eggs', 'tree_nuts']), 'Eggs, Tree nuts');

// A list saved on a phone meets the account: neither loses an allergy, and a copy is only ever its owner's.
assert.equal(mergeAllergies(null, null), null, 'never set stays never set');
assert.deepEqual(mergeAllergies([], null), [], 'None stays None');
assert.deepEqual(mergeAllergies([], ['tree_nuts']), ['tree_nuts'], 'an empty account does not drop what was picked on the phone');
assert.deepEqual(mergeAllergies(['eggs'], ['tree_nuts', 'eggs']), ['eggs', 'tree_nuts']);
assert.deepEqual(allergyCopyFor(allergyCopy('a', ['eggs']), 'a'), ['eggs']);
assert.equal(allergyCopyFor(allergyCopy('a', ['eggs']), 'b'), null, "someone else's copy never reads as yours");
assert.equal(allergyCopyFor(null, 'a'), null);

// The note once a change cleared the check (Loop-allergy, "A changed spec clears it").
const late = new Date('2026-11-01T12:00:00Z');
assert.equal(staleNote('2026-10-28T12:00:00Z', late), 'The spec changed on 28 Oct, so the check cleared. Guests see Ask your bartender until you check it again.');
assert.equal(staleNote(null, late), 'What goes in it changed, so the check cleared. Guests see Ask your bartender until you check it again.');

console.log(`allergen wording ok (${shapes.length} shapes)`);
