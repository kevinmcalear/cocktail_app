// Checks for lib/roleMatrix.ts and the roster lines in lib/team.ts.
// Run: npm run test:unit
import assert from 'node:assert/strict';

import { cell, columnCaption, dayOfEnd, endOfDay, endsLabel, overridesFor, roleSummary, type MatrixColumn } from './roleMatrix';
import { agoLabel, memberRoleName, memberSinceLine } from './team';

const base = (level: number, capabilities: string[]): MatrixColumn => ({
  role_id: null, name: null, base_level: level, ends_at: null, granted: [], revoked: [], capabilities,
});
const employee = base(20, ['menu', 'talking_points', 'locations']);
const barback: MatrixColumn = {
  role_id: 'r1', name: 'Barback', base_level: 20, ends_at: null, granted: ['house_made', 'prep'], revoked: [],
  capabilities: ['menu', 'talking_points', 'locations', 'house_made', 'prep'],
};
const matrix = [employee, barback];

// Cells: a venue role's extra capability is marked changed; shared ones aren't.
assert.deepEqual(cell(matrix, barback, 'prep'), { can: true, changed: true });
assert.deepEqual(cell(matrix, barback, 'menu'), { can: true, changed: false });
assert.deepEqual(cell(matrix, barback, 'costs'), { can: false, changed: false });
assert.deepEqual(cell(matrix, employee, 'prep'), { can: false, changed: false });

// Summaries read like the canvas.
assert.equal(roleSummary(barback), 'From Employee, plus house-made recipes and prep');
assert.equal(roleSummary({ base_level: 30, granted: [], revoked: ['photos'] }), 'From Bartender, no photos');
assert.equal(roleSummary({ base_level: 35, granted: ['costs'], revoked: [] }), 'From Drink Creator, plus costs');

// Overrides are what differs from the base level, and never level-bound ones.
assert.deepEqual(overridesFor(employee.capabilities, ['menu', 'talking_points', 'locations', 'prep', 'specs']), { granted: ['prep'], revoked: [] });
assert.deepEqual(overridesFor(employee.capabilities, ['menu']), { granted: [], revoked: ['talking_points', 'locations'] });

// An end date covers the whole picked day, and reads back as that day.
const end = endOfDay('2026-10-12')!;
assert.equal(dayOfEnd(end), '2026-10-12');
assert.equal(endsLabel(end), 'Mon 12 Oct');
assert.equal(endsLabel(endOfDay('2026-10-11')!), 'Sun 11 Oct');
assert.equal(endOfDay('12 Oct'), null);

// Column captions name the role, never its level number.
assert.equal(columnCaption(employee), 'Built in');
assert.equal(columnCaption(barback), 'Yours · from Employee');
assert.equal(columnCaption({ ...barback, ends_at: end }), 'Yours · ends Mon 12 Oct');
for (const c of [employee, barback, base(35, [])]) assert.doesNotMatch(columnCaption(c), /\d/);

// Roster lines.
assert.equal(memberRoleName({ role_level: 35, venue_role_name: 'Head bartender' }), 'Head bartender');
assert.equal(memberRoleName({ role_level: 30, venue_role_name: null }), 'Bartender');
assert.equal(
  memberSinceLine({ role_level: 30, joined_at: '2026-03-03T10:00:00Z', role_since: '2026-06-01T10:00:00Z' }),
  'Joined 3 Mar 2026 · Bartender since 1 Jun',
);
assert.equal(memberSinceLine({ role_level: 30, joined_at: '2026-03-03T10:00:00Z', role_since: '2026-03-03T11:00:00Z' }), 'Joined 3 Mar 2026');
assert.equal(
  memberSinceLine({ role_level: 20, venue_role_name: 'Barback', joined_at: '2025-12-01T10:00:00Z', role_since: '2026-01-05T10:00:00Z' }),
  'Joined 1 Dec 2025 · Barback since 5 Jan 2026',
);

const now = Date.parse('2026-10-11T12:00:00Z');
assert.equal(agoLabel('2026-10-11T08:00:00Z', now), 'today');
assert.equal(agoLabel('2026-10-10T08:00:00Z', now), 'yesterday');
assert.equal(agoLabel('2026-10-09T08:00:00Z', now), '2 days ago');
assert.equal(agoLabel('2026-09-20T08:00:00Z', now), '3 weeks ago');

console.log('roleMatrix checks passed');
