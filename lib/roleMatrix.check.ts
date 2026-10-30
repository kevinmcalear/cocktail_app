// Checks for lib/roleMatrix.ts and the roster lines in lib/team.ts.
// Run: npm run test:unit
import assert from 'node:assert/strict';

import {
  roleLine,
  cell, columnCaption, dayOfEnd, endOfDay, endsLabel, isChangedBuiltIn, isLocked, limitTo, overridesFor, reachCeiling, ROLE_PRESETS, roleSummary, drinkTypesToSave, drinkTypesLine,
  isCapability, today, toCapability, toggleLine, withinReach, withToggle, type MatrixColumn,
} from './roleMatrix';
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

// Overrides are what differs from the built-in role, any permission at all.
assert.deepEqual(overridesFor(employee.capabilities, ['menu', 'talking_points', 'locations', 'prep', 'specs']), { granted: ['specs', 'prep'], revoked: [] });
assert.deepEqual(overridesFor(employee.capabilities, ['menu']), { granted: [], revoked: ['talking_points', 'locations'] });

// A built-in role this venue changed: the dot is marked against where it started, and it can be reset.
const changedEmployee: MatrixColumn = { ...employee, granted: ['specs'], capabilities: [...employee.capabilities, 'specs'], starts_with: employee.capabilities };
assert.deepEqual(cell([changedEmployee], changedEmployee, 'specs'), { can: true, changed: true });
assert.deepEqual(cell([changedEmployee], changedEmployee, 'menu'), { can: true, changed: false });
assert.ok(isChangedBuiltIn(changedEmployee) && !isChangedBuiltIn(employee) && !isChangedBuiltIn(barback));

// Tapping a dot switches that column only, and works out the overrides again.
const admin = base(40, ['menu', 'staff', 'brand']);
const tapped = withToggle([employee, barback, admin], employee, 'specs', true);
assert.deepEqual(tapped[0].granted, ['specs']);
assert.ok(tapped[0].capabilities.includes('specs'));
assert.equal(tapped[1], barback);
const untapped = withToggle(tapped, barback, 'prep', false);
assert.deepEqual(untapped[1].granted, ['house_made']);
assert.deepEqual(withToggle(tapped, employee, 'specs', false)[0].granted, []);

// The Undo toast, and the one lock.
assert.equal(toggleLine('Head bartender', 'staff', true), 'Head bartender can now invite and manage staff');
assert.equal(toggleLine('Guest', 'menu', false), 'Guest can no longer see the menu and descriptions');
assert.ok(isLocked(admin, 'staff') && !isLocked(admin, 'brand') && !isLocked(employee, 'staff'));

// Ready-made roles, from the built-in role's permissions at this venue.
const preset = (id: string) => ROLE_PRESETS.find((p) => p.id === id)!;
assert.deepEqual(preset('apprentice').on(employee.capabilities).sort(), ['locations', 'menu', 'prep', 'specs', 'talking_points']);
assert.ok(preset('head').on(['menu', 'edit_drinks']).includes('staff'));
assert.deepEqual(preset('takeover').on(['menu', 'talking_points', 'photos']), ['menu', 'specs', 'locations']);
assert.ok(preset('takeover').ends && !preset('apprentice').ends);
// Beer and wine (tf-059): edits drinks, no costs or house-made recipes, its own kinds only.
assert.deepEqual(preset('beer-wine').on(['menu', 'costs', 'house_made', 'specs']).sort(), ['edit_drinks', 'menu', 'specs']);
assert.deepEqual(preset('beer-wine').drinkTypes, ['beer', 'wine']);
assert.deepEqual(drinkTypesToSave(['wine', 'beer']), ['beer', 'wine']);
assert.equal(drinkTypesToSave(['cocktail', 'beer', 'wine']), null);
assert.equal(drinkTypesToSave([]), null);
assert.equal(drinkTypesLine(['beer', 'wine']), 'Beer and wine only');
assert.equal(drinkTypesLine(['cocktail']), 'Cocktails only');
assert.equal(drinkTypesLine(null), null);
assert.match(today(Date.parse('2026-10-12T12:00:00')), /^2026-10-12$/);

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

// Handing out roles: an Admin anything; someone else only what they can do.
{
  const m = [10, 20, 30, 35, 40].map((l) => ({
    role_id: null, name: null, base_level: l, ends_at: null, granted: [], revoked: [],
    capabilities: l >= 30 ? ['menu', 'specs', 'photos'] : l >= 20 ? ['menu', 'specs'] : ['menu'],
  }));
  assert.equal(withinReach(['menu', 'costs'], null), true, 'an Admin is not limited');
  assert.equal(withinReach(['menu', 'costs'], ['menu', 'staff']), false);
  assert.equal(withinReach(['menu', 'costs'], ['menu'], ['costs']), true, 'what the role already has may stay');
  assert.deepEqual(limitTo(['menu', 'specs', 'staff'], ['menu', 'staff']), ['menu', 'staff']);
  assert.equal(reachCeiling(m, ['menu', 'specs', 'staff'], 30), 20, 'Bartender adds photos they lack');
  assert.equal(reachCeiling(m, null, 40), 40);
}

// Setup's role lines: the first sees, the rest add, an Admin does everything.
{
  const col = (l: number, capabilities: string[]) => ({ role_id: null, name: null, base_level: l, ends_at: null, granted: [], revoked: [], capabilities });
  const all = ['menu', 'talking_points', 'specs', 'house_made', 'locations', 'costs', 'edit_drinks', 'prep', 'photos', 'menus', 'publish', 'staff', 'brand'];
  const m = [
    col(10, ['menu']),
    col(20, ['locations', 'menu', 'talking_points']),
    col(30, ['menu', 'talking_points', 'locations', 'specs', 'photos']),
    col(35, ['menu', 'talking_points', 'locations', 'specs', 'photos', 'house_made', 'costs', 'edit_drinks', 'prep', 'menus']),
    col(40, all),
    { ...col(30, ['menu']), role_id: 'r1', name: 'Barback' },
  ];
  assert.equal(roleLine(m, 20), 'The menu, talking points and where things live. No specs.');
  assert.equal(roleLine(m, 30), 'Adds specs and photos.');
  assert.equal(roleLine(m, 35), 'Adds house-made recipes, costs, drink edits, prep and menus.');
  assert.equal(roleLine(m, 40), 'Everything.');
  assert.equal(roleLine(m, 99), '');
}

console.log('roleMatrix checks passed');

// Permission names: known ones pass through as the enum; an unknown one throws instead of saving less.
assert.equal(toCapability('prep'), 'prep');
assert.equal(isCapability('nope'), false);
assert.throws(() => toCapability('nope'), /Unknown permission: nope/);
