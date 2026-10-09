import assert from 'node:assert/strict';

import { barsCrediting, DEFAULT_IDENTITY, modeSummary, pickedShown, profileLine, taglineProblem, personTabs, type ShareMode, groupMenuCredits, handleFromName, instagramProblem, normalizeHandle, normalizeInstagram, parseProfileRef, profileDraftErrors, profileLinks, profileQueryShows, type MenuDrinkRow } from './profiles';

// Ids and handles, with or without the @; junk never reaches a query.
assert.deepEqual(parseProfileRef('3F2504E0-4F89-41D3-9A0C-0305E82C3301'), { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' });
assert.deepEqual(parseProfileRef('@Juniper.Jo'), { handle: 'juniper.jo' });
assert.deepEqual(parseProfileRef(['little_rye', 'extra']), { handle: 'little_rye' });
assert.equal(parseProfileRef(''), null);
assert.equal(parseProfileRef(undefined), null);
assert.equal(parseProfileRef('a'), null);
assert.equal(parseProfileRef('bad handle'), null);
assert.equal(parseProfileRef('.dot'), null);
assert.equal(parseProfileRef('x,id.eq.1'), null);

const menu = (id: string, name: string, active: boolean, barId: string | null, barName: string | null) => ({
  id,
  name,
  is_active: active,
  bar_id: barId,
  bar: barName ? { name: barName } : null,
});
const rows: MenuDrinkRow[] = [
  { item_id: 'd1', menu: menu('m1', 'Spring', false, 'b1', 'Little Rye') },
  { item_id: 'd1', menu: menu('m2', 'Autumn', true, 'b1', 'Little Rye') },
  { item_id: 'd2', menu: menu('m2', 'Autumn', true, 'b1', 'Little Rye') },
  { item_id: 'd2', menu: menu('m2', 'Autumn', true, 'b1', 'Little Rye') },
  { item_id: 'd3', menu: menu('m3', 'Night garden', true, 'b2', 'Pale Moth') },
  { item_id: 'd4', menu: null },
];
const credits = groupMenuCredits(rows);
// Current menus first (by bar), past ones after; a drink listed twice counts once.
assert.deepEqual(
  credits.map((c) => [c.menuName, c.current, c.itemIds]),
  [
    ['Autumn', true, ['d1', 'd2']],
    ['Night garden', true, ['d3']],
    ['Spring', false, ['d1']],
  ]
);
assert.equal(barsCrediting(credits), 2);
assert.equal(barsCrediting(credits.filter((c) => !c.current)), 0);
assert.deepEqual(groupMenuCredits([]), []);

console.log('profiles: ok');

// Your own profile: handles are saved normalised, and the form says what's wrong in the table's own limits.
assert.equal(normalizeHandle('  @Juniper.Jo '), 'juniper.jo');
assert.equal(handleFromName('Jo Juniper'), 'jo.juniper');
assert.equal(handleFromName('Zoë  O’Brien!'), 'zoe.o.brien');
assert.equal(handleFromName('Al'), '', 'too short for a handle');
assert.equal(handleFromName('大'), '');
assert.equal(handleFromName('x'.repeat(40)).length, 30);
const draft = { name: 'Jo', handle: '@Jo.Juniper', bio: '', instagram: '', isPublic: true, ...DEFAULT_IDENTITY };
assert.deepEqual(profileDraftErrors(draft), {});
assert.deepEqual(Object.keys(profileDraftErrors({ ...draft, name: '  ', handle: 'a', bio: 'x'.repeat(501), instagram: 'a..b' })), ['name', 'handle', 'bio', 'instagram']);
assert.ok(profileDraftErrors({ ...draft, handle: 'jo.' }).handle, 'no trailing dot');
assert.ok(profileDraftErrors({ ...draft, name: 'x'.repeat(81) }).name);

// One item shows by its section's mode and their pick; None hides everything but keeps the picks.
assert.equal(pickedShown('all', null), true);
assert.equal(pickedShown('all', false), false);
assert.equal(pickedShown('picked', null), false);
assert.equal(pickedShown('picked', true), true);
assert.equal(pickedShown('none', true), false);
assert.match(modeSummary('bars', 'all'), /never named, even beside a drink/);
assert.match(modeSummary('had', 'picked'), /^Only the ones you pick show/);
assert.equal(modeSummary('had', 'none'), 'None show. Your picks are kept for when you turn it back on.');
assert.match(modeSummary('originals', 'none'), /Credits still show/);

// A person's tabs: sections they show, everything to the owner.
const sharing = (h: ShareMode, b: ShareMode, m: ShareMode) => ({ had_mode: h, bars_mode: b, made_mode: m });
assert.deepEqual(personTabs(sharing('picked', 'picked', 'all'), false), ['had', 'bars', 'originals'], 'the default: picked sections show what is picked');
assert.deepEqual(personTabs(sharing('none', 'all', 'none'), false), ['bars']);
assert.deepEqual(personTabs(sharing('none', 'none', 'none'), false), [], 'shows nothing: no tabs');
assert.deepEqual(personTabs(sharing('none', 'none', 'none'), true), ['had', 'bars', 'originals'], 'the owner sees every tab');

// Instagram: a name, an @name, or an instagram.com link. Blank is fine. The CHECK in the migration is the same rule.
assert.equal(normalizeInstagram('  @Foo.Bar '), 'foo.bar');
assert.equal(normalizeInstagram('https://www.instagram.com/Foo.Bar/?hl=en'), 'foo.bar');
assert.equal(normalizeInstagram('instagram.com/otro___bar/'), 'otro___bar');
assert.equal(normalizeInstagram(''), '');
assert.equal(instagramProblem(''), undefined);
assert.equal(instagramProblem('_ok'), undefined);
assert.ok(instagramProblem('a..b'));
assert.ok(instagramProblem('.ab'));
assert.ok(instagramProblem('ab.'));
assert.ok(instagramProblem('x'.repeat(31)));
assert.deepEqual(profileLinks({ instagram: 'foo.bar', website: 'https://www.instagram.com/foo.bar/' }), [
  { href: 'https://www.instagram.com/foo.bar/', network: 'instagram' },
]);
assert.deepEqual(profileLinks({ instagram: 'foo.bar', website: 'https://example.com/bar/' }), [
  { href: 'https://www.instagram.com/foo.bar/', network: 'instagram' },
  { href: 'https://example.com/bar/', network: 'website' },
]);
// Other networks follow Instagram in a fixed order; anything else is dropped.
assert.deepEqual(
  profileLinks({
    instagram: 'foo.bar',
    website: 'https://foo.bar/',
    social_links: ['https://x.com/foobar', 'https://evil.example/x', 'https://www.facebook.com/foobar/', 'https://www.tiktok.com/@foo.bar'],
  }).map((l) => l.network),
  ['instagram', 'tiktok', 'facebook', 'x', 'website'],
);
// An old instagram.com website still gets the Instagram icon.
assert.deepEqual(profileLinks({ instagram: null, website: 'https://www.instagram.com/still.here/' }), [
  { href: 'https://www.instagram.com/still.here/', network: 'instagram' },
]);

// profileQueryShows: a write refetches only the profile pages it changed.
{
  const page = { id: 'p1', bar_id: 'b1', is_claimed: false };
  const other = { id: 'p2', bar_id: null, is_claimed: true };
  assert.equal(profileQueryShows(['profile', { id: 'p1' }, 'u'], page, { id: 'p1' }), true);
  assert.equal(profileQueryShows(['profile', { handle: 'x' }, 'u'], page, { id: 'p1' }), true, 'opened by handle');
  assert.equal(profileQueryShows(['profile', { id: 'p2' }, 'u'], other, { id: 'p1' }), false);
  assert.equal(profileQueryShows(['profile', { id: 'p1' }, 'u'], page, { barId: 'b1' }), true);
  assert.equal(profileQueryShows(['profile', { id: 'p2' }, 'u'], other, { barId: 'b1' }), false);
  assert.equal(profileQueryShows(['profile', { id: 'p1' }, 'u'], page, { unclaimed: true }), true);
  assert.equal(profileQueryShows(['profile', { id: 'p2' }, 'u'], other, { unclaimed: true }), false);
  assert.equal(profileQueryShows(['profile', { id: 'p1' }, 'u'], null, { id: 'p1' }), false, 'a not-found page waits for its own refetch');
  assert.equal(profileQueryShows(['profile', 'mine', 'u'], null, { mine: true }), true, 'yours, even before you have one');
  assert.equal(profileQueryShows(['profile', 'mine', 'u'], { id: 'p1' }, { id: 'p1' }), true);
  assert.equal(profileQueryShows(['profile', 'mine', 'u'], { id: 'p9' }, { id: 'p1' }), false);
  assert.equal(profileQueryShows(['profile-awards', 'p1'], page, { id: 'p1' }), false);
}

// The line under a name: a confirmed job they picked, else their own words, else nothing.
assert.equal(taglineProblem(' Home bartender '), undefined);
assert.equal(taglineProblem(''), undefined);
assert.ok(taglineProblem('x'.repeat(41)));
assert.ok(taglineProblem('two\nlines'));
const job = (over: Partial<{ id: string; is_current: boolean; is_shown: boolean; person_accepted: boolean; bar_accepted: boolean }>) => ({
  id: 'j1', title: 'Head bartender', is_current: true, is_shown: false, person_accepted: true, bar_accepted: true, bar: { display_name: 'Little Rye' }, ...over,
});
assert.equal(profileLine({ tagline: 'Home bartender', headline_position_id: null }, [job({})]), 'Home bartender');
assert.equal(profileLine({ tagline: 'Home bartender', headline_position_id: 'j1' }, [job({})]), 'Head bartender at Little Rye');
assert.equal(profileLine({ tagline: null, headline_position_id: 'j1' }, [job({ is_current: false, is_shown: true })]), 'Head bartender formerly at Little Rye');
// Not confirmed by the bar, or a past job they hid: back to their words.
assert.equal(profileLine({ tagline: 'Home bartender', headline_position_id: 'j1' }, [job({ bar_accepted: false })]), 'Home bartender');
assert.equal(profileLine({ tagline: null, headline_position_id: 'j1' }, [job({ is_current: false })]), null);
assert.equal(profileLine({ tagline: '  ', headline_position_id: null }, []), null);
