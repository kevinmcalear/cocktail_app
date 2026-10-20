// Checks for lib/discoverDrinks.ts. Run: npm run test:unit
// Matching, ranking and paging are SQL now: supabase/tests/discover-index.test.mjs.
import assert from 'node:assert/strict';

import {
  barDrinksLine,
  barInArea,
  barPins,
  barScoresFor,
  byScore,
  closedBars,
  closedLabel,
  closedPins,
  cursorAfter,
  drinkReason,
  distanceKm,
  findBars,
  kindParams,
  kindsTitle,
  pickFilter,
  resultsCaption,
  scorePins,
  toDiscoverBar,
  toDiscoverDrink,
  withBarOrder,
  type BarRow,
  type DiscoverBar,
  type DrinkRow,
  withoutHad,
} from './discoverDrinks';
import { pinDescription, pinLabel } from './discoverMap';
import type { DiscoverRow } from './nearMe';

const bar = (id: string, name: string, city: string | null, lat: number | null, lng: number | null, locality: string | null = null, drinks = 0): DiscoverBar => ({
  id,
  handle: id,
  name,
  logo: null,
  locality,
  city,
  countryCode: 'US',
  latitude: lat,
  longitude: lng,
  closed: false,
  closedYear: null,
  drinks,
});

const dante = bar('dante', 'Dante', 'New York', 40.7309, -74.0021, 'West Village', 2);
const attaboy = bar('attaboy', 'Attaboy', 'New York', 40.7196, -73.9899, null, 1);
const nomad = bar('nomad', 'Nomad', 'Los Angeles', 34.0452, -118.2519, null, 1);
const nowhere = bar('nowhere', 'No Address', 'New York', null, null, null, 1);
const bars = new Map([dante, attaboy, nomad, nowhere].map((b) => [b.id, b]));

const row = (id: string, name: string, barId: string, extra: Partial<DrinkRow> = {}): DrinkRow => ({
  id,
  name,
  description: null,
  image_url: null,
  bar_profile_id: barId,
  bar_handle: barId,
  bar_name: bars.get(barId)?.name ?? barId,
  bar_logo: null,
  bar_locality: null,
  bar_city: 'New York',
  menu_run: null,
  rank: 6,
  total_drinks: null,
  total_bars: null,
  ...extra,
});
const drink = (id: string, name: string, barId: string) => toDiscoverDrink(row(id, name, barId));
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);
const anywhere = { kind: 'anywhere' } as const;
const nearDante = { kind: 'point', latitude: 40.7309, longitude: -74.0021, radiusKm: 1, source: 'me' } as const;

// --- distance and areas ---
assert.ok(Math.abs(distanceKm({ latitude: 40.7309, longitude: -74.0021 }, { latitude: 40.7196, longitude: -73.9899 }) - 1.6) < 0.2, 'Dante to Attaboy is about 1.6 km');
assert.ok(barInArea(dante, nearDante));
assert.ok(!barInArea(attaboy, nearDante));
assert.ok(!barInArea(nowhere, nearDante), 'a bar with no coordinates is never near');
assert.ok(barInArea(nowhere, { kind: 'city', city: 'new york', country_code: 'US', label: 'New York' }), 'but it is in its city');
assert.ok(!barInArea(nomad, { kind: 'city', city: 'New York', country_code: 'US', label: 'New York' }));

// --- filters as the RPCs take them: any within a group, every group, notes as dimensions, sorted ---
assert.deepEqual(kindParams([]), { p_styles: null, p_spirits: null, p_notes: null });
assert.deepEqual(kindParams(['sour', 'gin', 'negroni', 'note:smoky', 'gin']), { p_styles: ['negroni', 'sour'], p_spirits: ['gin'], p_notes: ['smoky'] });
assert.equal(kindsTitle([]), 'Drinks');
assert.equal(kindsTitle(['martini', 'gin']), 'Martinis & Gin');
assert.equal(kindsTitle(['martini', 'gin', 'note:smoky']), 'Drinks, 3 filters');

// --- rows: menu tags, the bar, and the next page's cursor ---
const onNow = toDiscoverDrink(row('6', 'Negroni', 'dante', { menu_run: [2026, null, null, null, 1], rank: 0 }));
assert.deepEqual(onNow.menu, { onNow: true, past: null, order: 0, since: { year: 2026, month: null } });
const past = toDiscoverDrink(row('7', 'Old Negroni', 'dante', { menu_run: [2023, 3, 2024, 1, 0] }));
assert.equal(past.menu.order, 2);
assert.match(past.menu.past ?? '', /^Past · Mar 2023 to Jan 2024$/);
assert.equal(past.bar.name, 'Dante');
assert.deepEqual(cursorAfter(onNow), { p_after_rank: 0, p_after_name: 'Negroni', p_after_id: '6' });
// A mixed list (p_mix) pages by place, not rank.
const mixed = toDiscoverDrink(row('8', 'Free Spirit', 'dante', { menu_run: [2026, 8, null, null, 1], styles: ['zero-proof'], mix_pos: 31 }));
assert.deepEqual(cursorAfter(mixed), { p_after_pos: 31 });

// --- the one reason a mixed row carries: New (dated to the month, under three months on), else Zero-proof, else none ---
const oct15 = new Date(2026, 9, 15);
assert.equal(drinkReason(mixed, oct15), 'New', 'on since August');
assert.equal(drinkReason(mixed, new Date(2026, 10, 1)), 'Zero-proof', 'November: three months on, no longer new');
assert.equal(drinkReason(onNow, oct15), null, 'no month: not called new');
assert.equal(drinkReason(past, oct15), null, 'past menus are never new');
assert.equal(drinkReason({ menu: { onNow: true, past: null, order: 0, since: { year: 2027, month: 1 } }, styles: [] }, oct15), null, 'a date ahead of today is not new');

// --- bars: name first, then place ---
assert.deepEqual(ids(findBars([nomad, dante, attaboy], 'da')), ['dante']);
assert.deepEqual(ids(findBars([nomad, dante, attaboy], 'west vil')), ['dante'], 'by neighbourhood');
assert.deepEqual(ids(findBars([nomad, dante, attaboy], 'new york')), ['attaboy', 'dante'], 'by city, A to Z');
assert.deepEqual(findBars([dante], 'd'), [], 'one letter finds nothing');
assert.deepEqual(ids(findBars([bar('o', 'Origin Bar', null, null, null), bar('g', 'Bar Orchard Ginza', null, null, null)], 'gin')), ['g'], 'a word must start with it');

// --- pins: one per open bar with matching drinks and coordinates, most first, each once ---
const none = bar('none', 'Dry Bar', 'New York', 40.7, -74, null, 0);
const pins = barPins([nomad, dante, attaboy, nowhere, none, dante]);
assert.deepEqual(pins.map((p) => [p.id, p.drinks]), [['dante', 2], ['nomad', 1], ['attaboy', 1]]);

// --- closed bars: found by search after open ones, listed and pinned only when asked for ---
const shut = { ...bar('shut', 'Dante Annex', 'New York', 40.731, -74.002), closed: true, closedYear: 2019 };
const vague = { ...bar('vague', 'Attaboy Old', 'New York', null, null), closed: true, closedYear: null };
assert.deepEqual(ids(findBars([shut, dante], 'dante')), ['dante', 'shut'], 'the open bar first');
assert.equal(closedLabel(2019), 'Closed 2019');
assert.equal(closedLabel(null), 'Closed');
assert.deepEqual(ids(closedBars([dante, vague, shut], anywhere)), ['vague', 'shut'], 'only closed bars, by name');
assert.deepEqual(ids(closedBars([dante, vague, shut], nearDante)), ['shut'], 'in the area');
assert.deepEqual(closedPins([shut, vague]).map((p) => [p.id, p.closed]), [['shut', 'Closed 2019']], 'a pin needs coordinates');
assert.deepEqual(barPins([shut]), [], 'a closed bar is never a drinks pin');

// --- "Best Martini": the style alone among the styles, or the name searched ---
const f = { kinds: ['negroni', 'martini', 'gin'], search: '', area: anywhere };
assert.deepEqual(pickFilter(f, 'Martini').kinds, ['gin', 'martini']);
assert.deepEqual(pickFilter({ ...f, kinds: [] }, 'Martini').kinds, ['martini']);
assert.deepEqual(pickFilter({ ...f, search: 'smoky' }, 'Paper Plane'), { ...f, search: 'smoky Paper Plane' }, 'not a style lead: by name');

// --- scores, best first, every bar pinned ---
const picked = [drink('m1', 'Dante Martini', 'dante'), drink('m3', 'Gibson', 'attaboy'), drink('m4', 'Nomad Martini', 'nomad')];
const scored = { m3: 8.1, m4: 9.2 };
const dantesOwn: DiscoverRow = { position: 1, venue_profile_id: 'dante', handle: 'dante', display_name: 'Dante', locality: null, city: null, latitude: null, longitude: null, distance_km: null, score: 7.4, rankers: 25, is_early: false };
const barScores = barScoresFor(picked, scored, [dantesOwn]);
assert.deepEqual(barScores, { attaboy: { score: 8.1, rankers: 0 }, nomad: { score: 9.2, rankers: 0 }, dante: { score: 7.4, rankers: 25 } }, "the bar's own score, else its best drink's");
assert.deepEqual(ids(byScore(picked, scored)), ['m4', 'm3', 'm1'], 'scored first, best first, the rest kept');
const best = scorePins([...picked, drink('m6', 'Vesper', 'attaboy')], bars, { attaboy: { score: 8.1, rankers: 0 } });
assert.deepEqual(best.map((p) => [p.id, p.score, p.matches, p.drinks]), [['attaboy', 8.1, 2, undefined], ['dante', null, 1, undefined], ['nomad', null, 1, undefined]], 'every bar pinned, scored first');
assert.equal(pinLabel(best[0]), '8.1');
assert.equal(pinLabel(best[1]), '', 'an unscored bar is unmarked, not a count');
assert.equal(pinDescription(best[1]), 'Dante, 1 drink');
assert.equal(pinDescription(best[0]), 'Attaboy, score 8.1');

// A bar row's drinks in search: on now first, else how many match, else nothing (an older server sends no on_now).
assert.equal(barDrinksLine({ drinks: 20, onNow: 14 }), '14 drinks on now');
assert.equal(barDrinksLine({ drinks: 3, onNow: 0 }), '3 drinks');
assert.equal(barDrinksLine({ drinks: 1 }), '1 drink');
assert.equal(barDrinksLine({ drinks: 0, onNow: null }), null);

// A bar's venue brand from discover_bars: its accent and face for the monogram; none when it has no venue; not said by an older server.
const barRow = (extra: Partial<BarRow>): BarRow => ({ id: 'lr', handle: 'lr', display_name: 'Little Rye', avatar_url: null, locality: null, city: null, country_code: null, latitude: null, longitude: null, is_closed: false, closed_year: null, drinks: 0, ...extra });
assert.deepEqual(toDiscoverBar(barRow({ brand_accent: '#D0643B', brand_face: 'fraunces' })).brand, { accent: '#D0643B', face: 'fraunces' });
assert.equal(toDiscoverBar(barRow({ brand_accent: null, brand_face: null })).brand, null);
assert.equal(toDiscoverBar(barRow({})).brand, undefined);
assert.equal(barPins([{ ...toDiscoverBar(barRow({ brand_accent: '#D0643B', brand_face: null })), latitude: 1, longitude: 1, drinks: 2 }])[0]?.brand?.accent, '#D0643B', 'its pin carries it');

// --- Top bars' order onto the drinks layer's pins: on the list, its place; off it, none ---
const early = (id: string) => ({ venue_profile_id: id }) as DiscoverRow;
const ordered = withBarOrder(barPins([{ ...bar('x', 'X', null, 1, 1), drinks: 3 }, { ...bar('y', 'Y', null, 1, 1), drinks: 2 }]), [early('y'), early('z')]);
assert.deepEqual(ordered.map((p) => [p.id, p.order]), [['x', undefined], ['y', 0]]);

console.log('discoverDrinks: ok');

// "Not had yet": what's loaded, less the drinks you've had; the total less those it found.
{
  const loaded = [drink('a', 'Martini', 'attaboy'), drink('b', 'Vesper', 'nomad'), drink('c', 'Gibson', 'attaboy')];
  const left = withoutHad(loaded, { drinks: 40, bars: 12 }, ['b', 'zz']);
  assert.deepEqual(ids(left.drinks), ['a', 'c']);
  assert.deepEqual(left.totals, { drinks: 39, bars: 12 });
  assert.deepEqual(withoutHad(loaded, { drinks: 3, bars: 2 }, ['a', 'b', 'c']).totals, { drinks: 0, bars: 2 });
  assert.equal(withoutHad(loaded, null, ['a']).totals, null, 'no totals on a later page');
  assert.equal(withoutHad(loaded, { drinks: 3, bars: 2 }, []).drinks, loaded, 'nothing had: the same list');
}

// The results caption: the search count, else the phone sheet's line; wide screens have no sheet, so no line.
{
  const totals = { drinks: 14, bars: 9 };
  assert.equal(resultsCaption(true, totals, 'near you', 0, false), '14 drinks at 9 bars near you');
  assert.equal(resultsCaption(true, { drinks: 1, bars: 1 }, 'near you', 0), '1 drink at 1 bar near you');
  assert.equal(resultsCaption(false, null, 'near you', 3), '3 bars in view · tap or swipe up for the list', 'phone sheet unchanged');
  assert.equal(resultsCaption(true, { drinks: 0, bars: 0 }, 'near you', 1), '1 bar in view · tap or swipe up for the list', 'phone sheet, nothing found');
  assert.equal(resultsCaption(true, { drinks: 0, bars: 0 }, 'near you', 0, false), '', 'wide: no "0 bars in view" over an empty search');
  assert.equal(resultsCaption(true, null, 'near you', 0, false), '', 'wide: nothing while totals load');
}
