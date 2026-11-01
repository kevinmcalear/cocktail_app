// Checks for lib/rota.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { addDays, atWall, clockOf, closedOn, columnNote, copyShifts, dayHeading, dayShort, daysOfWeek, gridPeople, hoursLabel, mondayOf, nextShifts, nightOf, noClose, patchShifts, rotaMaker, sheetClock, shiftLength, shiftMoments, shiftTimes, totalHours, weekDays, weekLine, weekWindow, type RotaShift } from './rota';

const NY = 'America/New_York';
const shift = (id: string, user_id: string, starts_at: string, ends_at: string, o: Partial<RotaShift> = {}): RotaShift => ({ id, user_id, starts_at, ends_at, opens: false, closes: false, note: null, created_by: null, ...o });

// Days and weeks.
assert.equal(addDays('2026-10-31', 1), '2026-11-01');
assert.equal(mondayOf('2026-11-01'), '2026-10-26', 'Sunday belongs to the Monday before');
assert.equal(mondayOf('2026-10-26'), '2026-10-26');
assert.deepEqual(weekDays('2026-10-26').slice(-1), ['2026-11-01']);
assert.equal(weekLine('2026-10-26', 'en-GB'), '26 Oct to 1 Nov');
assert.equal(dayHeading('2026-10-31', 'en-GB'), 'Saturday 31');
assert.equal(dayShort('2026-11-01', 'en-GB'), 'Sun 1 Nov');

// Wall clocks in the bar's zone, across the clock change (1 Nov 2026 in New York).
assert.equal(atWall('2026-10-31', '19:00', NY), '2026-10-31T23:00:00.000Z', 'EDT');
assert.equal(atWall('2026-11-02', '19:00', NY), '2026-11-03T00:00:00.000Z', 'EST');
assert.equal(clockOf('2026-10-31T23:00:00.000Z', NY), '19:00');
assert.equal(clockOf(atWall('2026-11-02', '00:00', 'Asia/Tokyo'), 'Asia/Tokyo'), '00:00');

// A night runs to 6am.
assert.equal(nightOf('2026-11-01T05:00:00Z', NY), '2026-10-31', '1am Sunday is still Saturday night');
assert.equal(nightOf('2026-11-01T11:00:00Z', NY), '2026-11-01', '6am is the new day (EST by then)');

const w = weekWindow('2026-10-26', NY);
assert.equal(w.from, '2026-10-26T10:00:00.000Z');
assert.equal(w.to, '2026-11-02T11:00:00.000Z', 'the week ends at 6am EST');

// What the sheet's day and clocks make.
const late = shiftMoments('2026-10-30', '19:00', '02:00', NY);
assert.equal(late.starts_at, '2026-10-30T23:00:00.000Z');
assert.equal(late.ends_at, '2026-10-31T06:00:00.000Z', 'an end before the start is the next morning');
const small = shiftMoments('2026-10-30', '01:00', '03:00', NY);
assert.equal(nightOf(small.starts_at, NY), '2026-10-30', 'a start in the small hours stays on the night picked');
assert.equal(shiftMoments('2026-10-30', '16:00', '00:00', NY).ends_at, '2026-10-31T04:00:00.000Z', 'midnight ends the same night');

// Words.
assert.equal(shiftTimes(shiftMoments('2026-10-30', '16:00', '00:00', NY), NY), '4pm to 12am');
assert.equal(shiftTimes(shiftMoments('2026-10-30', '19:30', '02:00', NY), NY), '7:30pm to 2am');
assert.equal(sheetClock('00:00'), 'Midnight');
assert.equal(sheetClock('16:00'), '4pm');
assert.equal(hoursLabel(7.5), '7.5 h');
assert.equal(shiftLength(shiftMoments('2026-10-30', '18:00', '02:00', NY)), '8 h');
assert.equal(totalHours([shiftMoments('2026-10-29', '18:00', '02:00', NY), shiftMoments('2026-10-30', '19:00', '02:00', NY)]), '15 h');

// A week's nights and who closes.
const fri = shift('a', 'ana', atWall('2026-10-30', '18:00', NY), atWall('2026-10-31', '02:00', NY), { closes: true });
const sat = shift('b', 'theo', atWall('2026-10-31', '18:00', NY), atWall('2026-11-01', '02:00', NY));
const thu = shift('c', 'theo', atWall('2026-10-29', '18:00', NY), atWall('2026-10-30', '02:00', NY));
const days = daysOfWeek([sat, fri, thu], '2026-10-26', NY);
assert.deepEqual(days.map((d) => d.shifts.length), [0, 0, 0, 1, 1, 1, 0]);
assert.deepEqual(noClose(days, '2026-10-30').map((d) => d.day), ['2026-10-31'], 'a night gone by asks for nothing');
assert.deepEqual(noClose(days, '2026-11-01'), []);
const before = shift('d', 'theo', atWall('2026-10-25', '20:00', NY), atWall('2026-10-26', '07:00', NY));
assert.equal(daysOfWeek([before], '2026-10-26', NY).flatMap((d) => d.shifts).length, 0, "Sunday's late shift stays in Sunday's week");

// Bar hours.
assert.equal(closedOn({ mon: [['17:00', '01:00']] }, '2026-10-26'), false);
assert.equal(closedOn({ mon: [['17:00', '01:00']] }, '2026-10-27'), true);
assert.equal(closedOn(null, '2026-10-27'), false, 'hours nobody gave say nothing');
assert.deepEqual(columnNote('2026-10-30', '2026-10-30', true, false), { text: 'Closed', warn: false });
assert.deepEqual(columnNote('2026-10-30', '2026-10-30', false, true), { text: 'Tonight', warn: false });
assert.deepEqual(columnNote('2026-10-31', '2026-10-30', false, true), { text: 'No close', warn: true });
assert.equal(columnNote('2026-10-31', '2026-10-30', false, false), null);

// Copying a week keeps the clock across the clock change, skips leavers and shifts already there.
let n = 0;
const newId = () => `new-${n++}`;
const satNight = shift('e', 'ana', atWall('2026-10-31', '19:00', NY), atWall('2026-11-01', '02:00', NY), { closes: true, note: 'bar back' });
const copied = copyShifts({ from: [satNight, sat], days: 7, memberIds: ['ana'], existing: [], newId, timeZone: NY });
assert.equal(copied.gone, 1);
assert.equal(copied.rows.length, 1);
assert.equal(copied.rows[0].starts_at, atWall('2026-11-07', '19:00', NY));
assert.equal(clockOf(copied.rows[0].ends_at, NY), '02:00');
assert.equal(copied.rows[0].note, 'bar back');
assert.equal(copied.rows[0].closes, true);
const twice = copyShifts({ from: [satNight], days: 7, memberIds: ['ana'], existing: [shift('x', 'ana', atWall('2026-11-07', '19:00', NY), atWall('2026-11-08', '02:00', NY))], newId, timeZone: NY });
assert.equal(twice.rows.length, 0, 'copying twice adds nothing');
const fromDb = (at: string) => new Date(at).toISOString().replace('.000Z', '+00:00');
const again = copyShifts({ from: [satNight], days: 7, memberIds: ['ana'], existing: [shift('y', 'ana', fromDb(atWall('2026-11-07', '19:00', NY)), fromDb(atWall('2026-11-08', '02:00', NY)))], newId, timeZone: NY });
assert.equal(again.rows.length, 0, 'a row read back from Postgres (+00:00) still counts as there');

// A write shows at once, in the windows it falls in.
const list = [fri];
const row = { id: 'b', user_id: 'theo', starts_at: sat.starts_at, ends_at: sat.ends_at, opens: false, closes: false, note: null };
assert.deepEqual(patchShifts(list, { rows: [row], removed: [] }, w.from, w.to, 'me').map((s) => s.id), ['a', 'b']);
assert.equal(patchShifts(list, { rows: [row], removed: [] }, w.from, w.to, 'me')[1].created_by, 'me');
assert.deepEqual(patchShifts(list, { rows: [row], removed: [] }, weekWindow('2026-11-09', NY).from, weekWindow('2026-11-09', NY).to, 'me').map((s) => s.id), ['a'], 'outside the window it stays out');
assert.deepEqual(patchShifts(list, { rows: [], removed: ['a'] }, w.from, w.to, 'me'), []);
const moved = { ...row, id: 'a', starts_at: atWall('2026-11-10', '18:00', NY), ends_at: atWall('2026-11-11', '02:00', NY) };
assert.deepEqual(patchShifts(list, { rows: [moved], removed: [] }, w.from, w.to, 'me'), [], 'moved to another week, it leaves this one');

// A bartender's next shifts.
const on = [
  shift('1', 'theo', atWall('2026-10-30', '16:00', NY), atWall('2026-10-31', '00:00', NY), { opens: true }),
  shift('2', 'me', atWall('2026-10-30', '19:00', NY), atWall('2026-10-31', '02:00', NY), { closes: true }),
  shift('3', 'me', atWall('2026-10-31', '18:00', NY), atWall('2026-11-01', '02:00', NY)),
  shift('4', 'ana', atWall('2026-10-31', '16:00', NY), atWall('2026-11-01', '00:00', NY), { opens: true }),
  shift('5', 'maya', atWall('2026-10-31', '18:00', NY), atWall('2026-11-01', '02:00', NY)),
  shift('6', 'me', atWall('2026-11-03', '16:00', NY), atWall('2026-11-04', '00:00', NY), { opens: true }),
  shift('7', 'me', atWall('2026-11-05', '16:00', NY), atWall('2026-11-06', '00:00', NY)),
];
const names: Record<string, string> = { theo: 'Theo Grant', ana: 'Ana Ruiz', maya: 'Maya Okafor', me: 'Kevin' };
const next = nextShifts({ shifts: on, me: 'me', today: '2026-10-30', nameOf: (id) => names[id], timeZone: NY });
assert.equal(next.length, 3, 'the next three');
assert.match(next[0].title, /^Tonight, \S+ 30$/);
assert.equal(next[0].sub, 'Theo opens · you close');
assert.equal(next[1].sub, 'With Ana and Maya');
assert.equal(next[2].sub, 'You open');
assert.equal(nextShifts({ shifts: [on[1]], me: 'me', today: '2026-10-31', nameOf: (id) => names[id], timeZone: NY }).length, 0, 'a night gone by is gone');
assert.equal(nextShifts({ shifts: [on[2]], me: 'me', today: '2026-10-30', nameOf: (id) => names[id], timeZone: NY })[0].sub, 'On your own');

// Who makes the rota, and the grid's rows.
assert.equal(rotaMaker([shift('1', 'a', '', '', { created_by: 'ana' }), shift('2', 'a', '', '', { created_by: 'kev' }), shift('3', 'a', '', '', { created_by: 'ana' })]), 'ana');
assert.equal(rotaMaker([shift('1', 'a', '', '')]), null);
const team = [{ user_id: 'zed', name: 'Zed' }, { user_id: 'ana', name: 'Ana' }, { user_id: 'theo', name: 'Theo' }];
assert.deepEqual(gridPeople(team, [fri, thu], true).map((p) => p.name), ['Theo', 'Ana', 'Zed'], 'by first shift, then the rest of the team');
assert.deepEqual(gridPeople(team, [fri, thu], false).map((p) => p.name), ['Theo', 'Ana'], 'someone reading sees only who is on');
