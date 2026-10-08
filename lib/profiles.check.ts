import assert from 'node:assert/strict';

import { barsCrediting, DEFAULT_SHARING, personTabs, sharingSummary, groupMenuCredits, handleFromName, instagramProblem, normalizeHandle, normalizeInstagram, parseProfileRef, profileDraftErrors, profileLinks, type MenuDrinkRow } from './profiles';

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
const draft = { name: 'Jo', handle: '@Jo.Juniper', bio: '', instagram: '', isPublic: true, ...DEFAULT_SHARING };
assert.deepEqual(profileDraftErrors(draft), {});
assert.deepEqual(Object.keys(profileDraftErrors({ ...draft, name: '  ', handle: 'a', bio: 'x'.repeat(501), instagram: 'a..b' })), ['name', 'handle', 'bio', 'instagram']);
assert.ok(profileDraftErrors({ ...draft, handle: 'jo.' }).handle, 'no trailing dot');
assert.ok(profileDraftErrors({ ...draft, name: 'x'.repeat(81) }).name);

// What a public profile shows: each switch on its own.
assert.equal(
  sharingSummary(DEFAULT_SHARING),
  'Your profile shows the drinks you’ve made. Your scores still count, without your name, towards each bar’s score.'
);
assert.equal(
  sharingSummary({ sharesRankings: true, sharesBars: true, sharesMade: true }),
  'Your profile shows your score for every drink you’ve ranked, your average at each bar you’ve had drinks at, and the drinks you’ve made. Only people signed in to the app see what you’ve had, and drinks a bar hasn’t published stay out.'
);
assert.match(sharingSummary({ sharesRankings: true, sharesBars: false, sharesMade: true }), /says “At a bar”, not which one/);
assert.equal(
  sharingSummary({ sharesRankings: false, sharesBars: true, sharesMade: false }),
  'Your profile shows your average at each bar you’ve had drinks at. Only people signed in to the app see what you’ve had, and drinks a bar hasn’t published stay out. Your credits still show on each drink’s own page.'
);
assert.match(sharingSummary({ sharesRankings: false, sharesBars: false, sharesMade: false }), /^Your profile shows who you are and where you work, nothing more\./);

// A person's tabs: only what they share, everything to the owner.
const sharing = (r: boolean, b: boolean, m: boolean) => ({ shares_rankings: r, shares_bars: b, shares_made: m });
assert.deepEqual(personTabs(sharing(false, false, true), false), ['originals'], 'the default');
assert.deepEqual(personTabs(sharing(false, true, false), false), ['bars']);
assert.deepEqual(personTabs(sharing(true, true, true), false), ['had', 'bars', 'originals']);
assert.deepEqual(personTabs(sharing(false, false, false), false), [], 'shares nothing: no tabs');
assert.deepEqual(personTabs(sharing(false, false, false), true), ['had', 'bars', 'originals'], 'the owner sees every tab');

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
