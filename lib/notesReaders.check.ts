import assert from 'node:assert/strict';

import { notesReaderOptions } from './notesReaders';

// Little Rye on the E29 board: Apprentice with Employee, Takeover bartender
// with Bartender, Head bartender with Drink Creator.
const now = Date.parse('2026-10-26T12:00:00Z');
const roles = [
  { name: null, base_level: 20, ends_at: null },
  { name: 'Apprentice', base_level: 20, ends_at: null },
  { name: 'Takeover bartender', base_level: 30, ends_at: '2026-10-30T00:00:00Z' },
  { name: 'Head bartender', base_level: 35, ends_at: null },
  { name: 'Weekend guest', base_level: 30, ends_at: '2026-10-01T00:00:00Z' },
];

const rows = notesReaderOptions(roles, ['Rob'], now);
assert.deepEqual(
  rows.map((r) => [r.level, r.label, r.detail]),
  [
    [null, 'Everyone who sees the drink', 'Guests and staff, and the public if it is published'],
    [20, 'Employees and up', 'Employee, Apprentice, and everyone above'],
    [30, 'Bartenders and up', 'Bartender, Takeover bartender, Drink Creator, Head bartender, Admin'],
    [35, 'Drink Creators and up', 'Drink Creator, Head bartender, Admin'],
    [40, 'Admins', 'Rob'],
  ]
);

// A big team: the first few Admins, once each, and how many more.
assert.equal(notesReaderOptions([], ['Rob', 'Ash', 'Rob', 'Jo', 'Sam', 'Kit', 'Lee'], now)[4].detail, 'Rob, Ash, Jo, Sam and 2 more');

// No team list yet: Admins by role name. No roles of its own: the built-in names.
assert.equal(notesReaderOptions([], [], now)[4].detail, 'Admin');
assert.equal(notesReaderOptions([], [], now)[1].detail, 'Employee, Bartender, Drink Creator, Admin');

console.log('notesReaders ok');
