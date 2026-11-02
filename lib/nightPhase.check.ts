// Checks for lib/nightPhase.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { nextNight, nightPhase } from './nightPhase';

// Sunday 1 Nov 2026 is a Sunday; hours are worked out on the device's clock (no zone).
const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute);
const hours = { sun: [['18:00', '01:00']] as [string, string][], mon: [['18:00', '01:00']] as [string, string][] };

assert.equal(nightPhase(hours, at(1, 15)), 'before', 'before the bar opens');
assert.equal(nightPhase(hours, at(1, 20)), 'service', 'while it is open');
assert.equal(nightPhase(hours, at(2, 0, 30)), 'service', 'past midnight, still open');
assert.equal(nightPhase(hours, at(2, 1, 30)), 'after', 'after the 1am close, until 6am');
assert.equal(nightPhase(hours, at(2, 7)), 'before', 'the next morning is before doors');

const lunchDinner = { sun: [['12:00', '15:00'], ['18:00', '23:00']] as [string, string][] };
assert.equal(nightPhase(lunchDinner, at(1, 16)), 'before', 'between lunch and dinner');
assert.equal(nightPhase(lunchDinner, at(1, 23, 30)), 'after', 'after the last range today');

const shutSunday = { mon: [['18:00', '01:00']] as [string, string][] };
assert.equal(nightPhase(shutSunday, at(1, 21)), 'before', 'a shut day is before doors');
assert.equal(nightPhase(shutSunday, at(2, 3)), 'before', 'the small hours after a shut night are not after close');

assert.equal(nightPhase({}, at(1, 22)), 'service', 'empty hours guess like no hours');
assert.equal(nightPhase(null, at(1, 12)), 'before', 'no hours: before 5pm');
assert.equal(nightPhase(null, at(1, 22)), 'service', 'no hours: from 5pm');
assert.equal(nightPhase(null, at(2, 1)), 'service', 'no hours: until 2am');
assert.equal(nightPhase(null, at(2, 3)), 'after', 'no hours: 2am to 6am');

assert.equal(nextNight(new Date(2026, 9, 30), 'en-GB'), 'Saturday', 'a Friday night hands over to Saturday');

console.log('nightPhase checks passed');
