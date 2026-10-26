// Checks for lib/hoursWeek.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import type { WeekHours } from './barHours';
import { blocksOf, closedLine, closesNextDay, daysLabel, modeFor, setDay, switchMode, tapDay, weekFrom, weekGroups } from './hoursWeek';

// Little Rye: closed Mon, Tue to Thu 5 to midnight, Fri and Sat 4 to 2, Sun 4 to 11.
const rye: WeekHours = {
  mon: [],
  tue: [['17:00', '00:00']],
  wed: [['17:00', '00:00']],
  thu: [['17:00', '00:00']],
  fri: [['16:00', '02:00']],
  sat: [['16:00', '02:00']],
  sun: [['16:00', '23:00']],
};
const blocks = blocksOf(rye);
assert.equal(blocks.length, 3);
assert.equal(modeFor(blocks), 'each');
assert.equal(modeFor(blocksOf(null)), 'same');
assert.equal(modeFor(blocksOf({ mon: [['17:00', '00:00']], sat: [['12:00', '02:00']] })), 'split');

// Each day keeps every day exactly, and saves back to the same week.
assert.deepEqual(weekFrom(switchMode(blocks, 'each'), rye), rye);

// Weekdays and weekend: open days stay open, each half at its commonest range.
const split = switchMode(blocks, 'split');
assert.deepEqual(split[0], { days: ['tue', 'wed', 'thu', 'fri'], range: ['17:00', '00:00'] });
assert.deepEqual(split[1].days, ['sat', 'sun']);
assert.deepEqual(split[1].range, ['16:00', '02:00']);

// Same every day: Monday stays closed.
const same = switchMode(blocks, 'same');
assert.deepEqual(same, [{ days: ['tue', 'wed', 'thu', 'fri', 'sat', 'sun'], range: ['17:00', '00:00'] }]);
assert.equal(closedLine(same), 'Closed on Mon.');
assert.equal(closedLine(switchMode([], 'same')), 'Closed on Mon to Sun.');

// A tap moves a day between the halves, or off to close it.
const moved = tapDay(split, 1, 'fri');
assert.deepEqual(moved[0].days, ['tue', 'wed', 'thu']);
assert.deepEqual(moved[1].days, ['fri', 'sat', 'sun']);
assert.deepEqual(tapDay(moved, 1, 'fri')[1].days, ['sat', 'sun']);
assert.equal(weekFrom(tapDay(moved, 1, 'fri'), rye).fri?.length, 0);

// Each day: one day on its own, or closed.
const each = setDay(switchMode(blocks, 'each'), 'mon', ['12:00', '15:00']);
assert.deepEqual(weekFrom(each, rye).mon, [['12:00', '15:00']]);
assert.deepEqual(weekFrom(setDay(each, 'tue', null), rye).tue, []);

// Lunch and dinner set elsewhere survive when the day's first range didn't change.
const twice: WeekHours = { fri: [['12:00', '15:00'], ['17:00', '01:00']] };
assert.deepEqual(weekFrom(blocksOf(twice), twice).fri, twice.fri);
assert.deepEqual(weekFrom([{ days: ['fri'], range: ['18:00', '01:00'] }], twice).fri, [['18:00', '01:00']]);

assert.equal(closesNextDay(['16:00', '02:00']), true);
assert.equal(closesNextDay(['17:00', '00:00']), true);
assert.equal(closesNextDay(['12:00', '15:00']), false);

assert.equal(daysLabel(['tue', 'wed', 'thu']), 'Tue to Thu');
assert.equal(daysLabel(['fri', 'sat']), 'Fri and Sat');
assert.equal(daysLabel(['mon', 'wed', 'fri']), 'Mon, Wed and Fri');
assert.equal(daysLabel(['sun']), 'Sun');

assert.deepEqual(weekGroups(rye), [
  { days: 'Tue to Thu', text: '5pm to midnight', closed: false },
  { days: 'Fri and Sat', text: '4pm to 2am', closed: false },
  { days: 'Sun', text: '4pm to 11pm', closed: false },
  { days: 'Mon', text: 'Closed', closed: true },
]);

console.log('hoursWeek checks passed');
