// Checks for lib/searchCaptions.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import type { MenuSummary } from '@/types/menus';

import { drinkFacts, friendlyWhen, ingredientFacts, menuFacts, type MineFacts } from './searchCaptions';

const now = Date.parse('2026-10-10T20:00:00Z');
const menu = (id: string, name: string, startsAt: string | null, endsAt: string | null, itemIds: string[]): MenuSummary =>
  ({ id, name, barId: 'lr', createdBy: null, coverUrl: null, coverPosition: 50, startsAt, endsAt, createdAt: '2024-01-01', menuDate: null, guestCount: null, sharedAt: null, kind: 'menu', itemIds, pictures: [] }) as unknown as MenuSummary;
const facts: MineFacts = {
  menus: [menu('autumn', 'Autumn menu', '2026-09-01T00:00:00Z', null, ['neg', 'boul']), menu('spring', 'Spring', '2024-03-05T00:00:00Z', '2025-01-20T00:00:00Z', ['plum', 'neg'])],
  now,
  staff: ['x', 'y', 'z', 'neg'],
  unranked: ['late'],
  usedIn: new Map([['campari', ['neg', 'boul', 'plum', 'a', 'b', 'c']], ['batch', ['neg']]]),
  preps: new Set(['batch']),
};

assert.deepEqual(drinkFacts('neg', 'Cocktail', facts), { caption: 'On the Autumn menu · Classics 4' });
assert.deepEqual(drinkFacts('plum', 'Cocktail', facts), { caption: 'Cocktail', tag: 'Past · Mar 2024 to Jan 2025' });
assert.deepEqual(drinkFacts('plum', 'Cocktail', facts, true), { caption: 'Cocktail', tag: 'Past · 2024 to 2025' });
assert.deepEqual(drinkFacts('z', 'Cocktail', facts), { caption: 'Classics 3 · off menu' });
assert.deepEqual(drinkFacts('late', 'Cocktail', facts), { caption: 'Classics · off menu' });
assert.deepEqual(drinkFacts('new', 'Beer', facts), { caption: 'Beer' });

assert.equal(ingredientFacts('campari', facts), 'In 6 drinks');
assert.equal(ingredientFacts('batch', facts), 'Prep · in 1 drink');
assert.equal(ingredientFacts('salt', facts), undefined);

assert.equal(menuFacts('autumn', ['neg', 'boul', 'plum'], facts), 'On now · 2 of these drinks');
assert.equal(menuFacts('spring', ['x'], facts), 'Past');
assert.equal(menuFacts('gone', [], facts), undefined);

// Recent rows: day words, in the device's own timezone.
const at = new Date(2026, 9, 10, 20, 0).getTime(); // Saturday 10 Oct, 8pm
assert.equal(friendlyWhen(at - 20_000, at), 'just now');
assert.equal(friendlyWhen(at - 5 * 60_000, at), '5 minutes ago');
assert.equal(friendlyWhen(at - 2 * 3_600_000, at), '2 hours ago');
assert.equal(friendlyWhen(new Date(2026, 9, 9, 23, 0).getTime(), at), 'yesterday');
assert.equal(friendlyWhen(new Date(2026, 9, 5, 12, 0).getTime(), at), 'Monday');
assert.equal(friendlyWhen(new Date(2026, 9, 1, 12, 0).getTime(), at), '1 Oct');

console.log('searchCaptions checks passed');
