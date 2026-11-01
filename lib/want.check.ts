// Checks for lib/want.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { DIMENSIONS, type Profile } from './flavor';
import { endLine, likeLine, matchLabel, nearBars, nearLine, onboardingLine, splitNear, swipeOutcome, wantCount, wantedLine, wantRowLine, type NearRow } from './want';

// --- swipeOutcome: far enough or flicked, else back ---
assert.equal(swipeOutcome(150, 0, 400), 'want');
assert.equal(swipeOutcome(-150, 0, 400), 'pass');
assert.equal(swipeOutcome(40, 0, 400), null);
assert.equal(swipeOutcome(40, 1200, 400), 'want');
assert.equal(swipeOutcome(-40, -1200, 400), 'pass');
// A flick back the other way doesn't count.
assert.equal(swipeOutcome(40, -1200, 400), null);

// --- the words ---
assert.equal(matchLabel(92), '92% match');
assert.equal(matchLabel(null), null);
assert.equal(endLine(4), '4 on your Want list. We’ll tell you when one is on near you.');
assert.equal(endLine(1), '1 on your Want list. We’ll tell you when it’s on near you.');
assert.match(endLine(0), /^Nothing on your Want list yet/);
assert.equal(wantCount(12), 'You · 12 drinks');
assert.equal(wantCount(1), 'You · 1 drink');
assert.equal(onboardingLine({ bitter: 0.8, strong: 0.7, sweet: 0.1 }), 'You like it bitter and strong. Every drink now shows a match.');
assert.equal(onboardingLine(null), 'Every drink now shows a match.');

// --- likeLine: shared notes, then one you keep low ---
const profile = (p: Partial<Profile>): Profile => ({ ...(Object.fromEntries(DIMENSIONS.map((d) => [d, 0])) as Profile), ...p });
const jackRose = profile({ sour: 0.8, fruity: 0.7, sweet: 0.2, strong: 0.5 });
assert.equal(likeLine({ sour: 0.7, fruity: 0.6, sweet: 0.1, strong: 0.3 }, jackRose), 'You like sour, fruity, not too sweet');
assert.equal(likeLine({ creamy: 0.9 }, jackRose), null);

// --- nearBars: real pours only, one per bar, nearest first ---
const row = (id: string, name: string, bar: string, m: number | null, kind: string | null = 'name', text: string | null = null): NearRow => ({
  id,
  name,
  bar_profile_id: bar,
  bar_name: `Bar ${bar}`,
  bar_logo: null,
  match_kind: kind,
  match_text: text,
  distance_m: m,
});
const bars = nearBars(
  [
    row('1', 'Jack Rose', 'a', 2400),
    row('2', 'Jack Rose No. 2', 'a', 2400),
    row('3', 'Applejack Sour', 'b', 800, 'riff', 'Jack Rose'),
    row('4', 'Rose Spritz', 'c', 100, 'description'),
    row('5', 'Jack Rose', 'd', null),
  ],
  'Jack Rose'
);
assert.deepEqual(
  bars.map((b) => [b.barId, b.drinkId, b.km]),
  [
    ['b', '3', 0.8],
    ['a', '1', 2.4],
    ['d', '5', null],
  ]
);
assert.deepEqual(nearBars([row('1', 'Jack Rose', 'a', 10)], ''), []);

assert.equal(nearLine({ km: 0.8 }, true), 'Tonight · 0.5 mi');
assert.equal(nearLine({ km: null }, false), 'Tonight');
assert.equal(wantRowLine({ barName: 'Little Rye' }, '88% match'), 'Little Rye · tonight · 88% match');
assert.equal(wantRowLine(null, '92% match'), '92% match');
assert.equal(wantRowLine(null, null), '');
assert.equal(wantedLine({ barName: 'Little Rye' }), 'Want · on at Little Rye');
assert.equal(wantedLine(null), 'Want');

// --- splitNear: on near you nearest first, the rest as they were ---
const drinks = [{ itemId: 'x' }, { itemId: 'y' }, { itemId: null }, { itemId: 'z' }];
const near = { y: [{ drinkId: 'y1', barId: 'b', barName: 'B', barLogo: null, km: 3 }], z: [{ drinkId: 'z1', barId: 'c', barName: 'C', barLogo: null, km: 1 }], x: [] };
const split = splitNear(drinks, near);
assert.deepEqual(split.on.map((d) => d.itemId), ['z', 'y']);
assert.deepEqual(split.notYet.map((d) => d.itemId), ['x', null]);

console.log('want checks passed');
