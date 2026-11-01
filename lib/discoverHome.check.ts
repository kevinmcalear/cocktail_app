// Checks for lib/discoverHome.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import type { DiscoverDrink } from './discoverDrinks';
import { bestRows, closesLate, mapCaption, newMenus, openNow, placeName } from './discoverHome';
import type { MenuEdition } from './menuEditions';
import type { Area, DiscoverRow } from './nearMe';

const me: Area = { kind: 'point', latitude: 40.73, longitude: -74, radiusKm: 10, source: 'me' };

// --- placeName: the neighbourhood most nearby bars are in ---
assert.equal(placeName(me, [{ locality: 'West Village', city: 'New York' }, { locality: 'SoHo', city: 'New York' }, { locality: 'West Village', city: 'New York' }]), 'West Village');
assert.equal(placeName(me, [{ locality: null, city: 'New York' }]), 'New York', 'no neighbourhood: the city');
assert.equal(placeName(me, []), 'Near you', 'no bars yet');
assert.equal(placeName({ kind: 'city', city: 'Melbourne', country_code: 'AU', label: 'Melbourne' }, []), 'Melbourne');
assert.equal(placeName({ kind: 'anywhere' }, [{ locality: 'SoHo', city: null }]), 'Anywhere');

// --- openNow and closesLate, in the bar's own time zone ---
// Friday 30 Oct 2026, 9pm in New York.
const fri9pm = new Date('2026-10-31T01:00:00Z');
const hours = { fri: [['17:00', '02:00']] as [string, string][], sat: [['17:00', '23:00']] as [string, string][] };
assert.equal(openNow(hours, fri9pm, 'America/New_York'), true);
assert.equal(openNow({ mon: [['17:00', '23:00']] }, fri9pm, 'America/New_York'), false);
assert.equal(openNow(null, fri9pm, 'America/New_York'), null, 'unknown hours are unknown, not shut');
assert.equal(closesLate(hours, fri9pm, 'America/New_York'), true, 'Friday runs to 2am');
assert.equal(closesLate({ fri: [['17:00', '23:00']] }, fri9pm, 'America/New_York'), false);
assert.equal(closesLate(null, fri9pm, 'America/New_York'), false);

// --- bestRows: ranked bars only, named after the bar's own drink ---
const row = (position: number | null, id: string, score: number | null, rankers: number): DiscoverRow => ({
  position, venue_profile_id: id, handle: id, display_name: id.toUpperCase(), locality: null, city: null, latitude: null, longitude: null, distance_km: 0.5, score, rankers, is_early: position === null,
});
const drink = (id: string, barId: string, name: string) => ({ id, barId, name }) as DiscoverDrink;
const rows = bestRows([row(1, 'care', 9.1, 212), row(2, 'moth', 8.9, 96), row(null, 'new', null, 3)], [drink('d1', 'care', 'House Martini'), drink('d2', 'care', 'Dirty Martini')], 'Martini');
assert.deepEqual(rows.map((r) => [r.position, r.name, r.drinkId, r.rankers]), [[1, 'House Martini', 'd1', 212], [2, 'Martini', null, 96]], 'early bars left out; the first drink at the bar names it');
assert.equal(bestRows([row(1, 'a', 9, 40), row(2, 'b', 8, 30)], [], 'Martini').length, 2, 'every ranked row: the screen cuts the list');

// --- newMenus: on now, newest first, the month only when it's this month ---
const ed = (id: string, year: number, month: number | null, current = true): MenuEdition => ({ id, name: id, year, month, end_year: null, end_month: null, is_current: current, theme: null, drinks: [{ id: `${id}-1`, name: 'x' }] as MenuEdition['drinks'], source_url: null });
const menus = newMenus(
  [
    { barId: 'rye', barName: 'Little Rye', editions: [ed('Winter', 2026, 10), ed('Autumn', 2026, 9, false)] },
    { barId: 'care', barName: 'Caretaker’s', editions: [ed('Autumn', 2026, 9)] },
    { barId: 'owl', barName: 'Night Owl', editions: [ed('Green', 2025, null)] },
  ],
  fri9pm
);
assert.deepEqual(menus.map((m) => [m.name, m.sub, m.drinkId]), [['Winter', 'Little Rye · Oct', 'Winter-1'], ['Autumn', 'Caretaker’s', 'Autumn-1'], ['Green', 'Night Owl', 'Green-1']]);
assert.equal(newMenus([{ barId: 'a', barName: 'A', editions: [ed('Old', 2020, 1, false)] }], fri9pm).length, 0, 'past menus are not new');

// --- mapCaption ---
assert.equal(mapCaption(12, 30, me), '12 bars open near you');
assert.equal(mapCaption(0, 30, me), '30 bars near you', 'no hours known: how many bars');
assert.equal(mapCaption(1, 4, { kind: 'city', city: 'Melbourne', country_code: 'AU', label: 'Melbourne' }), '1 bar open in Melbourne');
