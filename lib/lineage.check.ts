import assert from 'node:assert/strict';

import {
  creditLabel,
  creditSentence,
  creditText,
  creators,
  hasLineage,
  isRiff,
  nameCredit,
  joinNames,
  MAX_ANCESTORS,
  shortNames,
  sortRiffs,
  styleChain,
  walkAncestors,
  yearLabel,
  type CreditProfile,
  type DrinkStyle,
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

  // Under the name: "Created by", the bar's place after its name, a classic's own lead.
  const sam = drink('pen', 'goldrush', { creator: person, origin_bar: bar, origin_year: 2005, is_catalog: true });
  assert.equal(creditText(nameCredit(sam, { id: 'goldrush', name: 'Gold Rush' })), 'Created by Sam Ross at Milk & Honey, New York, 2005');
  const riff = drink('smoke', 'naked', { origin_bar: { ...bar, display_name: 'Little Rye', locality: 'Brunswick' } });
  assert.equal(creditText(nameCredit(riff, { id: 'naked', name: 'Naked and Famous' })), 'Riff of Naked and Famous at Little Rye, Brunswick');
  const lastWord = drink('lw', null, { is_catalog: true, origin_year: 1916, origin_year_approx: true, origin_bar: { ...bar, display_name: 'Detroit Athletic Club', locality: null } });
  assert.equal(creditText(nameCredit(lastWord, null)), 'Classic, about 1916 · at Detroit Athletic Club');
  assert.equal(creditText(nameCredit(drink('daiq', null, { is_catalog: true }), null)), 'Classic');
  // A best guess names its range and says so.
  assert.equal(creditText(nameCredit(drink('bici', null, { is_catalog: true, origin_year: 1935, origin_year_guess: 'mid' }), null)), 'Classic, mid 1930s (best guess)');
  assert.equal(creditText(nameCredit(drink('mine', null, { creator: person }), null)), 'Created by Sam Ross');

  // A bar's own version of a classic is not a riff (dec-21, Eddie tf-086): the verdict decides, else the name.
  const americano = { id: 'amer', name: 'Americano' };
  assert.equal(isRiff({ name: 'Americano' }, americano, 'variation'), false, '35/35 instead of 40/40 is still the Americano');
  assert.equal(isRiff({ name: 'Americano' }, americano, 'same'), false);
  assert.equal(isRiff({ name: 'Americano' }, americano, 'unlisted'), false);
  assert.equal(isRiff({ name: 'Smoky Americano' }, americano, 'riff'), true);
  assert.equal(isRiff({ name: 'The Americano' }, americano), false, 'no verdict: the same name is a version');
  assert.equal(isRiff({ name: 'House Négroni' }, { name: 'Negroni' }), false);
  assert.equal(isRiff({ name: 'Negroni Sbagliato' }, { name: 'Negroni' }), true, 'no verdict: another name is a riff');
  assert.equal(isRiff({ name: 'Gin and Tonic' }, { name: 'Gin & Tonic', aliases: ['Gin and Tonic', 'G&T'] }), false, 'one of its other names is the same drink');
  const rye = { ...bar, id: 'b2', display_name: 'Little Rye', locality: 'Brunswick' };
  const barAmericano = drink('Americano', 'amer', { origin_bar: rye });
  assert.equal(creditText(nameCredit(barAmericano, americano, 'variation')), 'Americano by Little Rye, Brunswick');
  assert.equal(nameCredit(barAmericano, americano, 'variation')[0].drinkId, 'amer', 'the name links to the classic');
  assert.equal(creditText(nameCredit({ ...barAmericano, creator: person }, americano)), 'Americano by Sam Ross at Little Rye, Brunswick');
  assert.equal(creditText(nameCredit(drink('Americano', 'amer'), americano)), 'A version of the Americano');
  assert.equal(creditText(nameCredit({ ...barAmericano, name: 'Smoky Americano' }, americano, 'riff')), 'Riff of Americano at Little Rye, Brunswick');

  // Makers with no page, by name (tf-063): after the ones with a page, no link; a classic reads "Created by".
  const corpse = drink('Corpse Reviver No. 2', null, { is_catalog: true, creator_names: ['Harry Craddock'], origin_bar: { ...bar, display_name: 'The Savoy', locality: 'London' } });
  assert.equal(creditText(nameCredit(corpse, null)), 'Created by Harry Craddock at The Savoy, London');
  assert.equal(nameCredit(corpse, null)[1].profileId, undefined, 'a name with no page is not a link');
  assert.equal(creditText(nameCredit(drink('mine', null, { creator: person, creator_names: ['Jo Bloggs'] }), null)), 'Created by Sam Ross and Jo Bloggs');

  // Credit sentences leave out what isn't known and keep links on names.
  const full = drink('penicillin', 'goldrush', { creator: person, origin_bar: bar, origin_year: 2005 });
  const parts = creditSentence(full, { id: 'goldrush', name: 'Gold Rush' });
  assert.equal(creditText(parts), 'Riff of Gold Rush by Sam Ross at Milk & Honey, 2005');
  assert.deepEqual(parts.filter((p) => p.profileId).map((p) => p.profileId), ['p1', 'b1']);
  assert.equal(parts.find((p) => p.drinkId)?.drinkId, 'goldrush');
  assert.equal(creditText(creditSentence(drink('x', null, { creator: person }), null)), 'By Sam Ross');
  assert.equal(creditText(creditSentence(drink('x', null, { origin_bar: bar, origin_year: 1999 }), null)), 'At Milk & Honey, 1999');
  assert.equal(creditText(creditSentence(drink('x', 'y'), { id: 'y', name: 'Daiquiri' })), 'Riff of Daiquiri');
  // Several makers: first-named first, each a link, no repeats.
  const kitty: CreditProfile = { ...person, id: 'p2', handle: 'kitty', display_name: 'Kitty Gardner' };
  const tom: CreditProfile = { ...person, id: 'p3', handle: 'tom', display_name: 'Tom McHugh' };
  const team = drink('dt', null, { creator: person, co_creators: [{ profile: kitty }, { profile: tom }, { profile: person }, { profile: null }], origin_bar: bar });
  assert.deepEqual(creators(team).map((p) => p.id), ['p1', 'p2', 'p3']);
  assert.equal(creditText(creditSentence(team, null)), 'By Sam Ross, Kitty Gardner and Tom McHugh at Milk & Honey');
  assert.equal(creditSentence(team, null).filter((p) => p.profileId).length, 4);
  // Waiting and declined co-creators (back to editors only) stay out of the credit until they say yes (Q34).
  const asked = drink('ag', null, { creator: person, co_creators: [{ status: 'pending', profile: kitty }, { status: 'declined', profile: tom }] });
  assert.deepEqual(creators(asked).map((p) => p.id), ['p1']);
  assert.deepEqual(creators({ ...asked, co_creators: [{ status: 'accepted', profile: kitty }] }).map((p) => p.id), ['p1', 'p2']);
  assert.equal(joinNames(['Kitty']), 'Kitty');
  assert.equal(joinNames(['Kitty', 'Tom']), 'Kitty and Tom');
  assert.equal(joinNames([]), '');
  assert.equal(shortNames(['Kitty', 'Tom']), 'Kitty and Tom');
  assert.equal(shortNames(['Kitty', 'Darren', 'Tom']), 'Kitty and 2 others');
  // A year alone says nothing useful.
  assert.deepEqual(creditSentence(drink('x', null, { origin_year: 1920 }), null), []);

  assert.equal(hasLineage(null, [], []), false);
  assert.equal(hasLineage(drink('x', null), [], []), false);
  assert.equal(hasLineage(drink('x', null, { creator: person }), [], []), true);
  assert.equal(hasLineage(drink('x', null), [], [drink('r', 'x')]), true);

  // A bar's drink climbs to its classic by riff_of_id, then classic to classic by lineage_parent_id.
  const tree = new Map([
    ['goldrush', drink('goldrush', null, { is_catalog: true })],
    ['penicillin', drink('penicillin', null, { is_catalog: true, lineage_parent_id: 'goldrush' })],
    ['house', drink('house', 'penicillin')],
  ]);
  assert.deepEqual((await walkAncestors(tree.get('house')!, async (id) => tree.get(id) ?? null)).map((d) => d.id), ['goldrush', 'penicillin']);

  // Styles come back oldest first and survive a loop.
  const style = (id: string, parent: string | null): DrinkStyle => ({ id, key: id, name: id, family: 'sour', parent_style_id: parent, year: null, year_approx: false, summary: null });
  const styles = [style('punch', null), style('sour', 'punch'), style('fizz', 'sour')];
  assert.deepEqual(styleChain('fizz', styles).map((s) => s.id), ['punch', 'sour', 'fizz']);
  assert.deepEqual(styleChain(null, styles), []);
  assert.deepEqual(styleChain('a', [style('a', 'b'), style('b', 'a')]).map((s) => s.id), ['b', 'a']);
  assert.equal(hasLineage(drink('x', null), [], [], styles), true);

  // Approximate years and closed bars read naturally.
  assert.equal(yearLabel(1880, true), 'c. 1880');
  assert.equal(yearLabel(1888, false), '1888');
  assert.equal(yearLabel(null, true), null);
  assert.equal(yearLabel(1975, false, 'decade'), '1970s (best guess)');
  assert.equal(yearLabel(1935, true, 'mid'), 'mid 1930s (best guess)');
  assert.equal(yearLabel(1390, true), 'c. 1390');
  const closed: CreditProfile = { ...bar, display_name: 'Pegu Club', is_closed: true, closed_year: 2020 };
  assert.equal(
    creditText(creditSentence(drink('x', null, { creator: person, origin_bar: closed, origin_year: 2005, origin_year_approx: true }), null)),
    'By Sam Ross at Pegu Club (now closed), c. 2005'
  );

  console.log('lineage: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
