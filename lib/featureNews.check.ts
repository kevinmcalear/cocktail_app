import assert from 'node:assert/strict';

import { dayWord, dotTabs, mergeSeen, featureIcon, featureTab, firstName, lineNews, newsDetail, parseSeen, pendingNews, withSeen, type FeatureEvent } from './featureNews';

const NOW = new Date(2026, 9, 15, 18, 0).getTime();
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();
const ev = (id: string, feature: string, at: string, o: Partial<FeatureEvent> = {}): FeatureEvent => ({ id, feature, enabled: true, by_user: 'sam', at, ...o });
const opts = { me: 'jo', on: ['tonight', 'prep', 'history'], now: NOW };

// --- which switches are news ---
const tonight = ev('1', 'tonight', hoursAgo(1));
const prep = ev('2', 'prep', hoursAgo(5));
assert.deepEqual(pendingNews([prep, tonight], opts).map((e) => e.id), ['1', '2'], 'newest first');
assert.deepEqual(pendingNews([tonight], { ...opts, me: 'sam' }), [], 'never to the person who switched it on');
assert.deepEqual(pendingNews([ev('3', 'study', hoursAgo(1))], opts), [], 'only features that are on now');
assert.deepEqual(pendingNews([ev('4', 'tonight', hoursAgo(2)), ev('5', 'tonight', hoursAgo(1), { enabled: false })], opts), [], 'switched off again: no news');
assert.deepEqual(
  pendingNews([ev('6', 'tonight', hoursAgo(30), { enabled: false }), tonight], opts).map((e) => e.id),
  ['1'],
  'off then on again: the latest switch counts',
);
assert.deepEqual(pendingNews([ev('7', 'tonight', hoursAgo(15 * 24))], opts), [], 'older than two weeks is not new');
assert.deepEqual(pendingNews([tonight], { ...opts, joinedAt: hoursAgo(0.5) }), [], 'switched on before you joined');
assert.equal(pendingNews([ev('8', 'tonight', hoursAgo(1), { by_user: null })], opts).length, 1, 'someone without an account still makes news');

// --- the line, the dots and dismissing ---
const pending = pendingNews([prep, tonight, ev('9', 'history', hoursAgo(3))], opts);
assert.equal(lineNews(pending, {}, 'bar')?.id, '1', 'the newest shows');
let seen = withSeen({}, 'bar', tonight, 'line', NOW);
assert.equal(lineNews(pending, seen, 'bar')?.feature, 'history', 'the next follows after dismissing');
assert.equal(lineNews(pending, seen, 'other-bar')?.id, '1', 'per venue');
seen = withSeen(seen, 'bar', pending[1], 'line', NOW);
seen = withSeen(seen, 'bar', prep, 'line', NOW);
assert.equal(lineNews(pending, seen, 'bar'), null, 'all dismissed');
assert.deepEqual(dotTabs(pending, seen, 'bar').map((d) => d.tab), ['index', 'prep'], 'dismissing the line keeps the dots; History adds no tab');
seen = withSeen(seen, 'bar', tonight, 'tab', NOW);
assert.deepEqual(dotTabs(pending, seen, 'bar').map((d) => d.tab), ['prep'], 'opening the tab clears its dot');
const again = ev('10', 'tonight', hoursAgo(0.1));
assert.equal(lineNews(pendingNews([again], opts), seen, 'bar')?.id, '10', 'switched on again later is news again');

// --- storage ---
assert.deepEqual(parseSeen(null), {});
assert.deepEqual(parseSeen({ feature_news: { b: { tonight: { line: 'x', tab: 3 }, prep: 'nope' } } }), { b: { tonight: { line: 'x' } } }, 'only well-formed marks');
assert.deepEqual(parseSeen({ feature_news: 'x' }), {});
const old = withSeen({ b: { prep: { line: hoursAgo(20 * 24) } } }, 'b', tonight, 'line', NOW);
assert.deepEqual(old, { b: { tonight: { line: tonight.at } } }, 'marks past two weeks are dropped');

const phone = { b: { tonight: { line: tonight.at } } };
const ipad = { b: { tonight: { tab: hoursAgo(3) }, prep: { line: prep.at } } };
assert.deepEqual(
  mergeSeen(phone, ipad, { b: { tonight: { tab: hoursAgo(1) } } }),
  { b: { tonight: { line: tonight.at, tab: hoursAgo(1) }, prep: { line: prep.at } } },
  'merging keeps every mark, the later time of each',
);
assert.deepEqual(mergeSeen(null, undefined), {});

// --- wording ---
assert.equal(dayWord(hoursAgo(1), NOW), 'today');
assert.equal(dayWord(new Date(2026, 9, 14, 23, 0).toISOString(), NOW), 'yesterday');
assert.equal(dayWord(new Date(2026, 9, 3, 12, 0).toISOString(), NOW), '3 Oct');
assert.equal(firstName('Sam Rye'), 'Sam');
assert.equal(firstName('  '), null);
assert.equal(newsDetail(tonight, 'Sam', NOW, true), 'Sam turned it on today. Look for this tab.', 'the board’s words');
assert.equal(newsDetail(prep, null, NOW, false), 'Turned on today.');
assert.equal(featureTab('study'), 'test', 'Study’s route is still /test');
assert.equal(featureTab('history'), null);
assert.equal(featureIcon('tonight'), 'calendar', 'Tonight is the tab bar’s dated calendar');

console.log('featureNews checks passed');
