// Checks for lib/scores.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { DRINK_REASONS } from './rankResult';
import {
  barRanksLine, barScoreLine, belowFloorNote, bestPlaceLine, changeLine, cityPlaceLine, floorProgress, ladderStep, listsNextLine, monthMarks, myDrinkLine, previousLine, scoreFromLine, sinceDay, tallyRows, versionMark, whenHad, yourPlace,
} from './scores';

// --- the ladder's rungs (Loop-ladder steps 1 to 5) ---
const base = { score: null, bar: { floor: 50, ranks: 30, since: null, score: null }, city_list: null, postcode_list: null, list_floor: 5 };
assert.equal(ladderStep(base), 1, 'nothing yet: you and friends');
assert.equal(ladderStep({ ...base, bar: { ...base.bar, ranks: 64, score: 8.6 } }), 2, 'the bar has a score, the drink not yet');
const scored = { ...base, score: 8.9, city_list: { name: 'New York', bars: 1, position: 1 }, postcode_list: { name: '10014', bars: 1, position: 1 } };
assert.equal(ladderStep(scored), 3, 'its own score, lists not yet');
assert.equal(ladderStep({ ...scored, city_list: { name: 'New York', bars: 5, position: 3 } }), 4, 'five bars make a city list');
assert.equal(ladderStep({ ...scored, city_list: { name: 'New York', bars: 6, position: 3 }, postcode_list: { name: '10014', bars: 5, position: 1 } }), 5, 'and a postcode list');

assert.equal(belowFloorNote('Negroni', 'New York'), 'Not enough rankers yet in New York. A bar’s Negroni shows here once 20 people have ranked it there.');
assert.equal(belowFloorNote('Negroni', null), 'Not enough rankers yet. A bar’s Negroni shows here once 20 people have ranked it there.');
assert.equal(barRanksLine(64, '2026-09-14'), '64 ranks since September');
assert.equal(floorProgress(12, 20), '12 of 20');
assert.equal(floorProgress(25, 20), '20 of 20');
assert.equal(listsNextLine({ city: 'New York', city_list: { name: 'New York', bars: 1, position: 1 }, list_floor: 5 }), 'New York lists come next: 4 more bars need this drink on the list.');
assert.equal(listsNextLine({ city: 'New York', city_list: { name: 'New York', bars: 4, position: 1 }, list_floor: 5 }), 'New York lists come next: 1 more bar needs this drink on the list.');
assert.equal(listsNextLine({ city: null, city_list: null, list_floor: 5 }), null);
assert.equal(cityPlaceLine({ city: 'New York', city_list: { name: 'New York', bars: 6, position: 3 } }), '#3 in New York.');

const mine = [{ item_id: 'a', score: 9.4 }, { item_id: 'b', score: 9 }, { item_id: 'c', score: 7 }];
assert.deepEqual(yourPlace(mine, 'b', 'Negroni'), { title: 'Your 2nd best', score: '9.0', sub: 'of 3 Negronis' });
assert.deepEqual(yourPlace(mine.slice(0, 1), 'a', 'Negroni'), { title: 'Your best', score: '9.4', sub: 'your first Negroni' });
assert.equal(yourPlace(mine, 'z', 'Negroni'), null);

// --- the score page (Red-score) ---
assert.equal(scoreFromLine({ rankers: 62, current_rankers: 62, spec_since: null, version: 1, previous: null }), 'From 62 ranks, newest count most');
assert.equal(scoreFromLine({ rankers: 68, current_rankers: 6, spec_since: '2026-10-31', version: 5, previous: null }), 'From 6 ranks since the spec changed on 31 Oct');
assert.equal(scoreFromLine({ rankers: 62, current_rankers: 0, spec_since: '2026-10-31', version: 5, previous: null }), 'Version 5 has no ranks yet, so this is the score before it');
assert.equal(previousLine({ version: 4, score: 8.9, rankers: 62, from: '2026-10-03', to: '2026-10-31' }), 'Version 4: 8.9, from 62 ranks, 3 Oct to 31 Oct');
const months = ['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01'].map((month) => ({ month }));
assert.deepEqual(monthMarks(months).map((m) => m.label), ['Jun', 'Aug', 'Oct']);
assert.equal(versionMark([{ version: 4 }, { version: 4 }, { version: 4 }, { version: 4 }, { version: 5 }, { version: 5 }]), 4);
assert.equal(versionMark([{ version: 1 }, { version: 1 }]), null);

// --- what guests say (Loop-reasons, Kept-score) ---
assert.deepEqual(
  tallyRows({ too_sweet: 2, order_again: 18, beautiful: 12, mystery: 3 }, DRINK_REASONS).map((r) => [r.label, r.n, r.negative]),
  [['Would order again', 18, false], ['Beautiful', 12, false], ['mystery', 3, false], ['Too sweet', 2, true]]
);
assert.equal(myDrinkLine({ rankers: 34, liked: 31, reasons: { order_again: 20, too_sweet: 2 }, floor: 20 }), '31 liked · mostly Would order again');
assert.equal(myDrinkLine({ rankers: 30, liked: 22, reasons: { order_again: 9, too_sweet: 4 }, floor: 20 }), '22 liked · 4 say too sweet');
assert.equal(myDrinkLine({ rankers: 7, liked: null, reasons: null, floor: 20 }), '7 ranks · reasons show at 20');
assert.equal(changeLine(0.2, 'Winter'), 'Up 0.2 since Winter went on');
assert.equal(changeLine(-0.14, 'Winter'), 'Down 0.1 since Winter went on');
assert.equal(changeLine(0.01, 'Winter'), 'No change since Winter went on');
assert.equal(changeLine(null, 'Winter'), null);
assert.equal(barScoreLine({ drinks: 14, ranks: 212 }), 'From 14 ranked drinks, 212 ranks');
assert.equal(bestPlaceLine({ city_position: 1, city_bars: 6, ranked_as_name: 'Jack Rose', name: 'Jack Rose' }), '#1 Jack Rose in the city');
assert.equal(bestPlaceLine({ city_position: 1, city_bars: 1, ranked_as_name: 'Smoke Signal', name: 'Smoke Signal' }), 'Only here');

// --- people's rows ---
const now = new Date('2026-11-01T21:00:00');
assert.equal(whenHad({ had_on: '2026-11-01', created_at: '2026-11-01T22:00:00Z' }, now), 'Tonight');
assert.equal(whenHad({ had_on: '2026-10-31', created_at: '2026-10-31T22:00:00Z' }, now), 'Yesterday');
assert.equal(whenHad({ had_on: '2026-10-25', created_at: '2026-10-25T22:00:00Z' }, now), 'Last week');
assert.equal(whenHad({ had_on: '2026-10-02', created_at: '2026-10-02T22:00:00Z' }, now), 'October');
assert.equal(sinceDay('2026-10-26', now), 'Monday', 'a version that went on this week');
assert.equal(sinceDay('2026-11-01', now), 'today');
assert.equal(sinceDay('2026-10-03', now), '3 Oct');
