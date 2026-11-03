import assert from 'node:assert/strict';

import { addDays, barDay, clockAt, dailyLead, dailyLines, dayText } from './dailyList';

const TZ = 'America/New_York';
// Sun 1 Nov 2026, 4:10pm in New York.
const now = Date.parse('2026-11-01T21:10:00Z');
const at = (day: string, time = '17:00') => new Date(`${day}T${time}:00-05:00`).toISOString();

assert.equal(barDay(now, TZ), '2026-11-01');
// 1am in New York is still the 1st there, the 2nd in UTC.
assert.equal(barDay(Date.parse('2026-11-02T05:30:00Z'), TZ), '2026-11-02');
assert.equal(barDay(Date.parse('2026-11-02T04:30:00Z'), TZ), '2026-11-01');
assert.equal(addDays('2026-11-01', -1), '2026-10-31');
assert.equal(addDays('2026-12-31', 1), '2027-01-01');
assert.equal(dayText('2026-10-30', { locale: 'en-GB' }), 'Fri 30 Oct');
assert.equal(dayText('2026-09-21', { weekday: false, locale: 'en-GB' }), '21 Sept');

const lines = dailyLines(
  ['negroni', 'daiquiri', 'bees'],
  [
    // On every day since 1 Apr.
    { itemId: 'negroni', wentOn: at('2026-04-01'), cameOff: null },
    // On 21 Sep to 30 Sep, then back from 20 Oct: 10 + 13 days.
    { itemId: 'daiquiri', wentOn: at('2026-09-21'), cameOff: at('2026-09-30', '23:00') },
    { itemId: 'daiquiri', wentOn: at('2026-10-20'), cameOff: null },
    // Went on at 4pm today.
    { itemId: 'bees', wentOn: at('2026-11-01', '16:00'), cameOff: null },
    // Off after Friday's service.
    { itemId: 'clover', wentOn: at('2026-10-01'), cameOff: at('2026-10-30', '21:00') },
    // Taken off at 3pm today: its last night was yesterday.
    { itemId: 'oldfashioned', wentOn: at('2026-10-01'), cameOff: at('2026-11-01', '15:00') },
    // On and off again within a minute today: never on any night.
    { itemId: 'blip', wentOn: at('2026-11-01', '15:00'), cameOff: at('2026-11-01', '15:00') },
    // Put on and taken off again today, never on before.
    { itemId: 'tried', wentOn: at('2026-11-01', '14:00'), cameOff: at('2026-11-01', '15:00') },
    // Last on more than two weeks ago: not listed.
    { itemId: 'old', wentOn: at('2026-09-01'), cameOff: at('2026-10-10') },
  ],
  { now, timeZone: TZ, locale: 'en-GB' },
);
assert.deepEqual(
  lines.on.map((l) => [l.itemId, l.line, l.isNew]),
  [
    ['negroni', 'On every day since 1 Apr', false],
    ['daiquiri', 'On 23 days, since 21 Sept', false],
    ['bees', 'New today', true],
  ],
);
assert.deepEqual(
  lines.off.map((l) => [l.itemId, l.line]),
  [
    ['tried', 'Taken off today'],
    ['oldfashioned', 'Last on Sat 31 Oct'],
    ['clover', 'Last on Fri 30 Oct'],
  ],
);

// A drink on tonight with no run read yet (the list just loaded) is new.
assert.equal(dailyLines(['x'], [], { now, timeZone: TZ }).on[0].line, 'New today');

assert.equal(dailyLead(null, () => ''), 'Yesterday’s list, until someone changes it');
assert.equal(dailyLead(at('2026-11-01', '16:10'), (iso) => clockAt(iso, TZ, 'en-US')), 'Today’s list, written at 4:10pm');
assert.equal(clockAt(at('2026-11-01', '09:05'), TZ, 'en-US'), '9:05am');

console.log('dailyList ok');
