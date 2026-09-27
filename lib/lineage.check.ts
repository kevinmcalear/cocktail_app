import assert from 'node:assert/strict';

import {
  creditLabel,
  creditSentence,
  creditText,
  hasLineage,
  MAX_ANCESTORS,
  sortRiffs,
  walkAncestors,
  type CreditProfile,
  type LineageDrink,
} from './lineage';

const person: CreditProfile = { id: 'p1', kind: 'person', handle: 'sam', display_name: 'Sam Ross', avatar_url: null, locality: null };
const bar: CreditProfile = { id: 'b1', kind: 'bar', handle: 'mh', display_name: 'Milk & Honey', avatar_url: null, locality: 'New York' };

function drink(id: string, riffOf: string | null, extra: Partial<LineageDrink> = {}): LineageDrink {
  return { id, name: id, riff_of_id: riffOf, origin_year: null, credit_status: null, origin: null, creator: null, origin_bar: null, ...extra };
}

async function main() {
  // Ancestors come back root first, without the drink itself.
  const db = new Map([
    ['sour', drink('sour', null)],
    ['goldrush', drink('goldrush', 'sour')],
    ['penicillin', drink('penicillin', 'goldrush')],
  ]);
  const fetchDrink = async (id: string) => db.get(id) ?? null;
  assert.deepEqual(
    (await walkAncestors(db.get('penicillin')!, fetchDrink)).map((d) => d.id),
    ['sour', 'goldrush']
  );
  assert.deepEqual(await walkAncestors(db.get('sour')!, fetchDrink), []);

  // A parent the reader can't see ends the chain there.
  const hidden = new Map([['riff', drink('riff', 'secret')]]);
  assert.deepEqual(await walkAncestors(hidden.get('riff')!, async (id) => hidden.get(id) ?? null), []);

  // A loop (a > b > a) stops instead of spinning, and never includes the start.
  const loop = new Map([
    ['a', drink('a', 'b')],
    ['b', drink('b', 'a')],
  ]);
  assert.deepEqual((await walkAncestors(loop.get('a')!, async (id) => loop.get(id) ?? null)).map((d) => d.id), ['b']);

  // A very long chain is cut at MAX_ANCESTORS, keeping the nearest ones.
  const long = new Map<string, LineageDrink>(Array.from({ length: 20 }, (_, i) => [`d${i}`, drink(`d${i}`, i ? `d${i - 1}` : null)] as const));
  const cut = await walkAncestors(long.get('d19')!, async (id) => long.get(id) ?? null);
  assert.equal(cut.length, MAX_ANCESTORS);
  assert.equal(cut.at(-1)!.id, 'd18');

  // Riffs: verified, claimed, suggested, uncredited; ties by name. Input untouched.
  const riffs = [
    drink('Zed', 'x'),
    drink('Mezcal', 'x', { credit_status: 'suggested' }),
    drink('Apple', 'x', { credit_status: 'suggested' }),
    drink('No. 2', 'x', { credit_status: 'verified' }),
    drink('Smoked', 'x', { credit_status: 'claimed' }),
  ];
  assert.deepEqual(sortRiffs(riffs).map((r) => r.name), ['No. 2', 'Smoked', 'Apple', 'Mezcal', 'Zed']);
  assert.equal(riffs[0].name, 'Zed');

  // Status is always a word.
  assert.equal(creditLabel('verified'), 'Verified');
  assert.equal(creditLabel('claimed'), 'Claimed');
  assert.equal(creditLabel('suggested'), 'Suggested');
  assert.equal(creditLabel(null), null);

  // Credit sentences leave out what isn't known and keep links on names.
  const full = drink('penicillin', 'goldrush', { creator: person, origin_bar: bar, origin_year: 2005 });
  const parts = creditSentence(full, { id: 'goldrush', name: 'Gold Rush' });
  assert.equal(creditText(parts), 'Riff of Gold Rush by Sam Ross at Milk & Honey, 2005');
  assert.deepEqual(parts.filter((p) => p.profileId).map((p) => p.profileId), ['p1', 'b1']);
  assert.equal(parts.find((p) => p.drinkId)?.drinkId, 'goldrush');
  assert.equal(creditText(creditSentence(drink('x', null, { creator: person }), null)), 'By Sam Ross');
  assert.equal(creditText(creditSentence(drink('x', null, { origin_bar: bar, origin_year: 1999 }), null)), 'At Milk & Honey, 1999');
  assert.equal(creditText(creditSentence(drink('x', 'y'), { id: 'y', name: 'Daiquiri' })), 'Riff of Daiquiri');
  // A year alone says nothing useful.
  assert.deepEqual(creditSentence(drink('x', null, { origin_year: 1920 }), null), []);

  assert.equal(hasLineage(null, [], []), false);
  assert.equal(hasLineage(drink('x', null), [], []), false);
  assert.equal(hasLineage(drink('x', null, { creator: person }), [], []), true);
  assert.equal(hasLineage(drink('x', null), [], [drink('r', 'x')]), true);

  console.log('lineage: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
