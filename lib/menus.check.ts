import assert from 'node:assert/strict';

import type { MenuSectionDetail, MenuSummary } from '@/types/menus';

import { groupMenus, menuAsText, menuDateLine, menuReadiness, menuStatus, newDrinkCount, sectionRule } from './menus';

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

// --- grouping and order ---
const menu = (id: string, startsAt: string | null, endsAt: string | null, createdAt = '2026-01-01T00:00:00Z'): MenuSummary => ({
  id, name: id, barId: 'bar', createdBy: null, coverUrl: null, coverPosition: 50,
  startsAt: startsAt && d(startsAt), endsAt: endsAt && d(endsAt), createdAt: d(createdAt), itemIds: [], event: null,
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
  ],
  now
);
assert.deepEqual(groups.on.map((m) => m.id), ['autumn', 'beer']);
assert.deepEqual(groups.upcoming.map((m) => m.id), ['takeover', 'xmas']);
assert.deepEqual(groups.draft.map((m) => m.id), ['winter', 'old draft']);
assert.deepEqual(groups.previous.map((m) => m.id), ['summer', 'spring']);

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

console.log('menus: ok');
