// Checks for lib/barHours.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { clockLabel, hoursLine, hoursSource, hoursStatus, parseHours, weekRows, type WeekHours } from './barHours';

const LITTLE_RYE: WeekHours = {
  mon: [],
  tue: [['17:00', '00:00']],
  wed: [['17:00', '00:00']],
  thu: [['17:00', '00:00']],
  fri: [['16:00', '01:00']],
  sat: [['16:00', '01:00']],
  sun: [['15:00', '23:00']],
};
const MEL = 'Australia/Melbourne';
// 2026-10-10 is a Saturday. Melbourne is UTC+11 in October (daylight time).
const mel = (iso: string) => new Date(`${iso}+11:00`);

// Clock labels.
assert.equal(clockLabel('17:00'), '5pm');
assert.equal(clockLabel('17:30'), '5:30pm');
assert.equal(clockLabel('00:00'), 'midnight');
assert.equal(clockLabel('12:00'), 'noon');
assert.equal(clockLabel('01:00'), '1am');
assert.equal(clockLabel('09:05'), '9:05am');

// Open, then past midnight still open on Saturday's range.
assert.equal(hoursLine(LITTLE_RYE, mel('2026-10-10T21:00:00'), MEL), 'Open now · until 1am');
assert.equal(hoursLine(LITTLE_RYE, mel('2026-10-11T00:30:00'), MEL), 'Open now · until 1am');
// Sunday 1:10am: Saturday's range has closed; opens 3pm the same day.
assert.equal(hoursLine(LITTLE_RYE, mel('2026-10-11T01:10:00'), MEL), 'Closed · opens 3pm');
// Closed Monday: next is Tuesday 5pm.
assert.equal(hoursLine(LITTLE_RYE, mel('2026-10-12T19:00:00'), MEL), 'Closed · opens 5pm Tue');
// Sunday night after close: next is Tuesday (Monday is closed).
assert.equal(hoursLine(LITTLE_RYE, mel('2026-10-11T23:30:00'), MEL), 'Closed · opens 5pm Tue');
// Until midnight.
assert.equal(hoursLine(LITTLE_RYE, mel('2026-10-13T18:00:00'), MEL), 'Open now · until midnight');

// The bar's own zone, whatever the reader's: 21:00 in Melbourne is 10:00 UTC.
assert.equal(hoursStatus(LITTLE_RYE, new Date('2026-10-10T10:00:00Z'), MEL)?.open, true);
assert.equal(hoursStatus(LITTLE_RYE, new Date('2026-10-10T10:00:00Z'), 'America/New_York')?.open, false, '6am Saturday in New York');

// A Sunday range past midnight covers Monday morning.
const lateSunday: WeekHours = { sun: [['20:00', '02:00']] };
assert.equal(hoursLine(lateSunday, mel('2026-10-12T01:00:00'), MEL), 'Open now · until 2am');
assert.equal(hoursLine(lateSunday, mel('2026-10-12T03:00:00'), MEL), 'Closed · opens 8pm Sun');

// Two ranges a day: lunch, then the evening.
const split: WeekHours = { fri: [['12:00', '15:00'], ['17:00', '02:00']] };
assert.equal(hoursLine(split, mel('2026-10-16T13:00:00'), MEL), 'Open now · until 3pm');
assert.equal(hoursLine(split, mel('2026-10-16T16:00:00'), MEL), 'Closed · opens 5pm');
assert.equal(hoursLine(split, mel('2026-10-17T01:00:00'), MEL), 'Open now · until 2am');

// A range to midnight that runs into one from midnight reads as one.
const joined: WeekHours = { fri: [['18:00', '00:00']], sat: [['00:00', '03:00'], ['18:00', '23:00']] };
assert.equal(hoursLine(joined, mel('2026-10-16T22:00:00'), MEL), 'Open now · until 3am');

// Never open, unknown hours.
assert.equal(hoursLine({}, mel('2026-10-10T21:00:00'), MEL), 'Closed');
assert.equal(hoursLine(null, mel('2026-10-10T21:00:00'), MEL), null);

// An unknown zone falls back to the device clock instead of throwing.
assert.ok(hoursStatus(LITTLE_RYE, new Date(), 'Not/AZone'));

// The week for the sheet.
const rows = weekRows(LITTLE_RYE, mel('2026-10-10T21:00:00'), MEL);
assert.deepEqual(rows[0], { day: 'Monday', text: 'Closed', closed: true, today: false });
assert.equal(rows[1].text, '5pm to midnight');
assert.equal(rows[5].text, '4pm to 1am');
assert.equal(rows[5].today, true);
assert.equal(weekRows(split, mel('2026-10-10T21:00:00'), MEL)[4].text, 'noon to 3pm, 5pm to 2am');

// Off-shape data from the database is dropped.
assert.equal(parseHours(null), null);
assert.equal(parseHours([]), null);
assert.deepEqual(parseHours({ mon: [['17:00', '25:00'], ['17:00', '23:00']], tue: 'x', xyz: [] }), { mon: [['17:00', '23:00']] });

// Where they come from.
const oct = new Date(2026, 9, 10);
assert.equal(hoursSource(true, new Date(2026, 9, 3, 12).toISOString(), oct), 'From the bar · updated 3 Oct');
assert.equal(hoursSource(false, new Date(2025, 0, 9, 12).toISOString(), oct), 'Hours checked 9 Jan 2025 · may have changed');
assert.equal(hoursSource(true, null, oct), 'From the bar');
