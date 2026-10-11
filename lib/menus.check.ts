import assert from 'node:assert/strict';

import { toDay } from '@/lib/collection';
import type { MenuSectionDetail, MenuSummary } from '@/types/menus';

import { groupMenus, homeMenuLine, homeNight, ingredientLine, menuAsText, menuDateLine, menuReadiness, menuStatus, newDrinkCount, sectionRule } from './menus';

const now = Date.parse('2026-09-25T18:00:00Z');
const d = (iso: string) => new Date(iso).toISOString();

// --- status mirrors private.menu_on_now ---
assert.equal(menuStatus({ startsAt: null, endsAt: null }, now), 'draft');
assert.equal(menuStatus({ startsAt: d('2026-10-03T19:00:00Z'), endsAt: null }, now), 'upcoming');
assert.equal(menuStatus({ startsAt: d('2026-09-01T00:00:00Z'), endsAt: null }, now), 'on');
assert.equal(menuStatus({ startsAt: d('2026-09-01T00:00:00Z'), endsAt: d('2026-12-01T00:00:00Z') }, now), 'on');
assert.equal(menuStatus({ startsAt: d('2026-06-03T00:00:00Z'), endsAt: d('2026-08-31T00:00:00Z') }, now), 'previous');
// Legacy menus that were never current: an end with no start.
assert.equal(menuStatus({ startsAt: null, endsAt: d('2026-09-20T00:00:00Z') }, now), 'previous');
// The instant it starts, it's on; the instant it ends, it's previous.
assert.equal(menuStatus({ startsAt: new Date(now).toISOString(), endsAt: null }, now), 'on');
assert.equal(menuStatus({ startsAt: d('2026-09-01T00:00:00Z'), endsAt: new Date(now).toISOString() }, now), 'previous');

// --- a home menu's night: dated is a finished menu, only undated is still a draft ---
assert.equal(menuStatus({ startsAt: null, endsAt: null, menuDate: null }, now), 'draft');
assert.equal(menuStatus({ startsAt: null, endsAt: null, menuDate: '2026-10-04' }, now), 'upcoming');
// Tonight is the local day, whatever time zone the check runs in.
assert.equal(menuStatus({ startsAt: null, endsAt: null, menuDate: toDay(new Date(now)) }, now), 'on');
assert.equal(menuStatus({ startsAt: null, endsAt: null, menuDate: '2026-09-20' }, now), 'previous');
// The venue calendar still wins when a menu has one.
assert.equal(menuStatus({ startsAt: d('2026-09-01T00:00:00Z'), endsAt: null, menuDate: '2026-10-04' }, now), 'on');
assert.equal(menuDateLine({ startsAt: null, endsAt: null, menuDate: '2026-10-04' }, now, 'en-GB'), null, 'its night is homeMenuLine');

// --- grouping and order ---
const menu = (id: string, startsAt: string | null, endsAt: string | null, createdAt = '2026-01-01T00:00:00Z'): MenuSummary => ({
  id, name: id, barId: 'bar', createdBy: null, coverUrl: null, coverPosition: 50,
  startsAt: startsAt && d(startsAt), endsAt: endsAt && d(endsAt), createdAt: d(createdAt), menuDate: null, guestCount: null, sharedAt: null, kind: 'menu', itemIds: [], pictures: [], event: null,
});
const groups = groupMenus(
  [
    menu('summer', '2026-06-03', '2026-08-31'),
    menu('spring', '2026-03-04', '2026-06-02'),
    menu('autumn', '2026-09-01', null),
    menu('beer', '2026-06-03', null),
    menu('takeover', '2026-10-03T19:00:00Z', null),
    menu('xmas', '2026-12-01', null),
    menu('winter', null, null, '2026-09-20'),
    menu('old draft', null, null, '2026-05-01'),
    { ...menu('flights', null, null), kind: 'rnd' },
    { ...menu('assignments', null, null), kind: 'rnd' },
  ],
  now
);
assert.deepEqual(groups.on.map((m) => m.id), ['autumn', 'beer']);
assert.deepEqual(groups.upcoming.map((m) => m.id), ['takeover', 'xmas']);
assert.deepEqual(groups.draft.map((m) => m.id), ['winter', 'old draft']);
assert.deepEqual(groups.previous.map((m) => m.id), ['summer', 'spring']);
assert.deepEqual(groups.rnd.map((m) => m.id), ['assignments', 'flights'], 'R&D is filed apart, by name');

// --- date lines ---
assert.equal(menuDateLine(menu('a', '2026-09-01T12:00:00Z', null), now, 'en-GB'), 'since Tue 1 Sept');
assert.equal(menuDateLine(menu('b', '2026-10-03T12:00:00Z', null), now, 'en-GB'), 'starts Sat 3 Oct');
assert.equal(menuDateLine(menu('c', '2026-06-03T12:00:00Z', '2026-08-31T12:00:00Z'), now, 'en-GB'), '3 Jun to 31 Aug');
assert.equal(menuDateLine(menu('d', null, '2026-09-20T12:00:00Z'), now, 'en-GB'), 'off since 20 Sept');
assert.equal(menuDateLine(menu('e', null, null), now, 'en-GB'), null);

// --- readiness ---
const drink = (name: string, extra: Partial<MenuSectionDetail['drinks'][number]> = {}) => ({
  id: name, name, kind: 'cocktail' as const, line: '', price: '18', imageUrl: 'https://x/y.jpg', isSketch: false, glass: null, ...extra,
});
const section = (name: string, minItems: number, maxItems: number | null, drinks: ReturnType<typeof drink>[]): MenuSectionDetail => ({
  id: name, name, minItems, maxItems, allowedTypes: ['cocktail'], drinks,
});
const r = menuReadiness({
  sections: [
    section('Stirred', 3, 5, [drink('Martini'), drink('Bolo Tie'), drink('Mulholland Drive', { imageUrl: 'https://x/s.jpg', isSketch: true })]),
    section('Long & bright', 2, 4, [drink('Piña Colada', { price: null })]),
    section('Beer', 0, 1, [drink('Pils', { imageUrl: null }), drink('Lager')]),
  ],
});
assert.deepEqual(r.short, [{ name: 'Long & bright', needed: 1 }]);
assert.deepEqual(r.over, [{ name: 'Beer', extra: 1 }]);
assert.deepEqual(r.needsPhoto, ['Mulholland Drive', 'Pils']);
assert.deepEqual(r.noPrice, ['Piña Colada']);
assert.equal(r.canGoLive, false);
assert.equal(menuReadiness({ sections: [section('Stirred', 1, null, [drink('Martini')])] }).canGoLive, true);
// An empty menu can't go on, even with no minimums.
assert.equal(menuReadiness({ sections: [section('Stirred', 0, null, [])] }).canGoLive, false);

// --- new drinks ---
assert.equal(newDrinkCount(['a', 'b', 'c', 'c'], [{ itemIds: ['a'] }, { itemIds: ['b', 'x'] }]), 1);
assert.equal(newDrinkCount(['a'], []), 1);

// --- section rules ---
assert.equal(sectionRule({ allowedTypes: ['cocktail'], minItems: 3, maxItems: 5 }), 'Cocktails · 3 to 5');
assert.equal(sectionRule({ allowedTypes: ['beer'], minItems: 0, maxItems: 3 }), 'Beer · up to 3');
assert.equal(sectionRule({ allowedTypes: ['cocktail', 'beer', 'wine'], minItems: 1, maxItems: null }), 'Any drink');
assert.equal(sectionRule({ allowedTypes: ['beer', 'wine'], minItems: 2, maxItems: null }), 'Beer & Wine · 2 or more');

// --- plain text for the share sheet ---
assert.equal(
  menuAsText(
    {
      name: 'Autumn menu',
      sections: [
        section('Stirred', 1, null, [drink('House Martini', { line: 'Gin, dry vermouth' }), drink('Bolo Tie', { price: '19.50' }), drink('Rye', { price: '  ' })]),
        section('Empty', 0, null, []),
      ],
    },
    'Little Rye'
  ),
  'Autumn menu at Little Rye\n\nSTIRRED\nHouse Martini 18\n  Gin, dry vermouth\nBolo Tie 19.50\nRye'
);

// --- a home menu's night ---
assert.equal(homeMenuLine({ menuDate: '2026-10-03', guestCount: 6 }, now, 'en-GB'), 'Sat 3 Oct · 6 guests');
assert.equal(homeMenuLine({ menuDate: null, guestCount: 1 }, now, 'en-GB'), '1 guest');
assert.equal(homeMenuLine({ menuDate: null, guestCount: null }, now), null);
const at = new Date(2026, 8, 25, 21, 0).getTime();
assert.deepEqual(homeNight({ when: 'tonight', date: '', guests: '6' }, at), { menuDate: '2026-09-25', guestCount: 6 });
assert.deepEqual(homeNight({ when: 'tomorrow', date: '', guests: '' }, at), { menuDate: '2026-09-26', guestCount: null });
assert.deepEqual(homeNight({ when: 'date', date: '2026-10-4', guests: ' 12 ' }, at), { menuDate: '2026-10-04', guestCount: 12 });
assert.deepEqual(homeNight({ when: 'none', date: 'junk', guests: '' }, at), { menuDate: null, guestCount: null });
assert.ok('error' in homeNight({ when: 'date', date: 'next sat', guests: '' }, at));
assert.ok('error' in homeNight({ when: 'none', date: '', guests: '0' }, at));
assert.ok('error' in homeNight({ when: 'none', date: '', guests: '2.5' }, at));
assert.ok('error' in homeNight({ when: 'none', date: '', guests: '501' }, at));

console.log('menus: ok');

// --- a cocktail's menu line: spec order, each ingredient once ---
assert.equal(ingredientLine(['Fernet-Branca', 'Heavy Cream', 'Coffee Liqueur', 'heavy cream ', null, '']), 'Fernet-Branca, Heavy Cream, Coffee Liqueur');
assert.equal(ingredientLine([]), '');
