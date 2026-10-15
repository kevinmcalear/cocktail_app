import assert from 'node:assert/strict';

import { toDay } from '@/lib/collection';
import type { MenuSectionDetail, MenuSummary } from '@/types/menus';

import { cardWhen, EMPTY_PLAN, isSouthern, menuNameIdeas, nextMondays, savedLine, seasonOf, nightLine, venuePlan, comingUpLine, sectionLine, draftLine, dotLine, editedWhen, isOneNightMenu, isOneNightRun, previousLine, groupMenus, homeMenuLine, homeNight, ingredientLine, menuAsText, readingName, sentenceLine, menuDateLine, menuReadiness, menuStatus, newDrinkCount, newDrinkIds, sectionRule, tonightLine } from './menus';

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
assert.equal(menuDateLine({ startsAt: d('2026-09-01T00:00:00Z'), endsAt: null, menuDate: '2026-10-04' }, now, 'en-GB'), null, 'shared early, still its night');

// --- grouping and order ---
const menu = (id: string, startsAt: string | null, endsAt: string | null, createdAt = '2026-01-01T00:00:00Z'): MenuSummary => ({
  id, name: id, barId: 'bar', createdBy: null, coverUrl: null, coverPosition: 50,
  startsAt: startsAt && d(startsAt), endsAt: endsAt && d(endsAt), createdAt: d(createdAt), menuDate: null, guestCount: null, sharedAt: null, kind: 'menu', updatedAt: d(createdAt), description: null, plannedStartsAt: null, plannedEndsAt: null, itemIds: [], shortSections: 0, pictures: [], event: null,
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
assert.equal(readingName({ name: 'Dry Vermouth', ingredient_role: 'generic' }), 'dry vermouth');
assert.equal(readingName({ name: 'Campari', ingredient_role: 'product' }), 'Campari');
assert.equal(readingName({ name: 'Fig Leaf Syrup', ingredient_role: 'prep' }), 'fig leaf syrup');
assert.equal(readingName(null), null);
assert.equal(sentenceLine(ingredientLine(['gin', 'dry vermouth', 'Campari'])), 'Gin, dry vermouth, Campari');

{
  assert.deepEqual([...newDrinkIds(['a', 'b', 'c'], [{ itemIds: ['b'] }, { itemIds: ['c'] }])], ['a']);
  const thu = new Date(2025, 8, 25, 19);
  assert.equal(tonightLine(thu, [{ name: 'Autumn menu' }], 8, 'en-GB'), `${thu.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · Autumn menu · 8 drinks`);
  assert.equal(tonightLine(thu, [{ name: 'A' }, { name: 'B' }], 12, 'en-GB').endsWith(' · 2 menus on · 12 drinks'), true);
  assert.equal(tonightLine(thu, [], 0, 'en-GB').includes('·'), false);
  assert.equal(dotLine('Gin, dry vermouth, orange bitters'), 'Gin · dry vermouth · orange bitters');
  assert.equal(dotLine('Rye, amaro, orange.'), 'Rye · amaro · orange');
}

{
  const now = new Date(2026, 9, 11, 15).getTime();
  const at = (d: number, h = 12) => new Date(2026, 9, d, h).toISOString();
  assert.equal(editedWhen(new Date(now - 5 * 60_000).toISOString(), now), 'edited just now');
  assert.equal(editedWhen(at(11, 9), now), 'edited today');
  assert.equal(editedWhen(at(10), now), 'edited yesterday');
  assert.equal(editedWhen(at(8), now), 'edited 3 days ago');
  assert.match(editedWhen(at(1), now, 'en-GB'), /^edited 1 Oct/);
  assert.equal(draftLine({ itemIds: ['a', 'b'], updatedAt: at(10), shortSections: 1 }, now), '1 section short · edited yesterday');
  assert.equal(draftLine({ itemIds: ['a', 'b'], updatedAt: at(10), shortSections: 0 }, now), '2 drinks · edited yesterday');
  assert.equal(draftLine({ itemIds: [], updatedAt: at(10), shortSections: 0 }, now), 'No drinks yet · edited yesterday');
  assert.ok(isOneNightRun('2026-10-31T18:00:00Z', '2026-11-01T02:00:00Z'));
  assert.ok(!isOneNightRun('2026-10-31T18:00:00Z', '2026-11-03T02:00:00Z'));
  assert.ok(isOneNightMenu({ startsAt: null, endsAt: null, plannedStartsAt: '2026-10-31T18:00:00Z', plannedEndsAt: '2026-11-01T02:00:00Z', kind: 'menu' }));
  assert.ok(!isOneNightMenu({ startsAt: null, endsAt: null, plannedStartsAt: '2026-10-31T18:00:00Z', plannedEndsAt: '2026-11-01T02:00:00Z', kind: 'rnd' }));
  const fri = new Date(2026, 9, 31, 18).toISOString();
  const night = comingUpLine({ startsAt: fri, endsAt: new Date(2026, 10, 1, 2).toISOString(), menuDate: null, itemIds: ['a', 'b', 'c', 'd'], event: null, guestCount: null }, 'en-GB');
  assert.match(night, /^One night · 4 drinks · Sat 31 Oct$|^One night · 4 drinks · Fri 31 Oct$/);
  const takeover = comingUpLine({ startsAt: fri, endsAt: null, menuDate: null, itemIds: ['a'], event: { id: 'e', name: 'Pale Moth', startsAt: fri }, guestCount: null }, 'en-GB');
  assert.match(takeover, /^Takeover · 1 drink · from /);
  assert.equal(previousLine({ startsAt: new Date(2026, 5, 3).toISOString(), endsAt: new Date(2026, 7, 31).toISOString(), itemIds: ['a', 'b', 'a'] }, 'en-GB'), '3 Jun to 31 Aug · 2');
}

{
  const any = ['cocktail', 'beer', 'wine'];
  assert.deepEqual(sectionLine({ allowedTypes: any, minItems: 0, maxItems: null, drinks: [1, 2, 3] }), { text: 'Any drink · 3 in', problem: false });
  assert.deepEqual(sectionLine({ allowedTypes: any, minItems: 2, maxItems: 3, drinks: [1] }), { text: '2 to 3 drinks · 1 in · needs one more', problem: true });
  assert.deepEqual(sectionLine({ allowedTypes: ['beer'], minItems: 0, maxItems: 2, drinks: [1, 2, 3] }), { text: 'Beer · up to 2 · 3 in · 1 too many', problem: true });
}

{
  const base = { startsAt: null, endsAt: null, menuDate: null, plannedStartsAt: null, plannedEndsAt: null };
  assert.equal(cardWhen(base), null);
  assert.equal(cardWhen({ ...base, menuDate: '2026-10-31' }, 'en-GB'), 'Saturday 31 October');
  assert.equal(cardWhen({ ...base, plannedStartsAt: new Date(2026, 9, 31, 18).toISOString(), plannedEndsAt: new Date(2026, 10, 1, 2).toISOString() }, 'en-GB'), 'Saturday 31 October');
  assert.equal(cardWhen({ ...base, startsAt: new Date(2026, 11, 1, 6).toISOString() }, 'en-GB'), 'From Tue 1 December');
  // Shared on the 9th, for the night of the 31st: the eyebrow names the night.
  assert.equal(cardWhen({ ...base, menuDate: '2026-10-31', startsAt: new Date(2026, 9, 9, 11).toISOString() }, 'en-GB'), 'Saturday 31 October');
}

{
  assert.deepEqual(venuePlan(EMPTY_PLAN), { plannedStartsAt: null, plannedEndsAt: null });
  assert.deepEqual(venuePlan({ kind: 'run', date: '', time: '' }), { error: 'Pick a day.' });
  const night = venuePlan({ kind: 'night', date: '2026-10-31', time: '18:00' });
  assert.ok(!('error' in night));
  if (!('error' in night)) {
    assert.equal(new Date(night.plannedStartsAt!).getHours(), 18);
    assert.ok(isOneNightRun(night.plannedStartsAt, night.plannedEndsAt), 'a night is one night');
    assert.equal(new Date(night.plannedEndsAt!).getDate(), 1);
  }
  const late = venuePlan({ kind: 'night', date: '2026-10-31', time: '01:00' });
  if (!('error' in late)) assert.equal(new Date(late.plannedEndsAt!).getDate(), 31, 'a night from 1am ends that morning');
  const run = venuePlan({ kind: 'run', date: '2026-12-01', time: '' });
  if (!('error' in run)) assert.equal(run.plannedEndsAt, null);
  assert.match(nightLine(new Date(2026, 9, 31, 18).toISOString(), 'en-US'), /^Saturday, October 31, from 6 pm$/);
}

// --- New menu's name ideas and quick picks ---
{
  const oct = new Date(2026, 9, 15);
  assert.equal(seasonOf(oct, false), 'Autumn');
  assert.equal(seasonOf(oct, true), 'Spring', 'October is spring in Melbourne');
  assert.equal(seasonOf(new Date(2026, 11, 7), false), 'Winter');
  assert.equal(seasonOf(new Date(2026, 1, 1), false), 'Winter', 'February is still winter up north');
  assert.equal(seasonOf(new Date(2026, 1, 1), true), 'Summer');
  assert.equal(isSouthern(-37.8, null), true);
  assert.equal(isSouthern(51.5, 'Australia/Melbourne'), false, 'a latitude wins');
  assert.equal(isSouthern(null, 'Australia/Melbourne'), true);
  assert.equal(isSouthern(null, 'Pacific/Auckland'), true);
  assert.equal(isSouthern(null, 'America/New_York'), false);
  assert.equal(isSouthern(undefined, undefined), false);
  assert.deepEqual(menuNameIdeas({ at: new Date(2026, 11, 7), southern: false }), ['Winter menu', 'December', 'Holiday menu']);
  assert.deepEqual(menuNameIdeas({ at: oct, southern: true }), ['Spring menu', 'October', 'Halloween']);
  assert.deepEqual(menuNameIdeas({ at: oct, southern: false, copied: 'Autumn menu' }), ['Winter menu', 'Autumn menu', 'October']);
  assert.deepEqual(menuNameIdeas({ at: new Date(2026, 3, 2), southern: false, copied: 'Fall 2025' }), ['Winter menu', 'Spring menu', 'April']);
  assert.deepEqual(menuNameIdeas({ at: new Date(2026, 6, 2), southern: false, copied: 'Summer menu' }), ['Autumn menu', 'Summer menu', 'July']);
  // Thursday 15 October 2026: the next two Mondays.
  assert.deepEqual(nextMondays(new Date(2026, 9, 15, 12).getTime()), ['2026-10-19', '2026-10-26']);
  // On a Monday, the next one is a week on.
  assert.deepEqual(nextMondays(new Date(2026, 9, 19, 9).getTime(), 1), ['2026-10-26']);
  assert.deepEqual(nextMondays(new Date(2026, 9, 18, 9).getTime(), 1), ['2026-10-19']);
}
assert.equal(savedLine(['Autumn menu', 'Summer menu', 'Spring menu', 'Seasonal three']), 'Autumn, Summer and 2 more');
assert.equal(savedLine(['Autumn menu', 'Summer menu', 'Spring menu', 'Seasonal three'], true), 'Autumn, Summer, 2 more');
assert.equal(savedLine(['Autumn menu', 'Halloween']), 'Autumn and Halloween');
assert.equal(savedLine(['Autumn menu']), 'Autumn');
assert.equal(savedLine(['Test', 'Test', 'Autumn menu']), 'Test and Autumn', 'a name twice is named once');
