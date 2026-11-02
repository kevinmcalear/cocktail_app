import assert from 'node:assert/strict';

import {
  askedAgo, canManageTeam, canOpenMember, canSeeTeam, INVITE_ROLES, invitedDay, inviteRoleOptions, looksLikeEmail, nextShiftLabel, personName, sinceLabel, TEAM_MANAGE, TEAM_SEE, teamGroup, teamLine, teamSections,
} from './team';

const NOW = Date.parse('2026-11-01T12:00:00Z');

assert.equal(TEAM_SEE, 20);
assert.equal(TEAM_MANAGE, 40);
assert.equal(canSeeTeam(10), false);
assert.equal(canSeeTeam(20), true);
assert.equal(canManageTeam(35), false);
assert.equal(canManageTeam(40), true);

assert.equal(personName({ display_name: ' Ada ', email: 'ada@bar.test' }), 'Ada');
assert.equal(personName({ display_name: '', email: 'ada@bar.test' }), 'ada');
assert.equal(personName({ display_name: null, email: null }), 'Team member');

assert.deepEqual(INVITE_ROLES.map((r) => r.level), [20, 30, 35, 40]);

// --- the As list on Invite > By email ---
assert.equal(looksLikeEmail(' sam@bar.test '), true);
assert.equal(looksLikeEmail('Sam Okafor'), false);
assert.equal(looksLikeEmail('sam@'), false);
const matrix = [
  { role_id: null, name: null, base_level: 30, ends_at: null },
  { role_id: 'tk', name: 'Takeover bartender', base_level: 30, ends_at: null },
  { role_id: 'old', name: 'Last year', base_level: 30, ends_at: '2026-01-01T00:00:00Z' },
  { role_id: 'soon', name: 'Guest shift', base_level: 20, ends_at: '2026-12-05T12:00:00Z' },
  { role_id: 'hd', name: 'Head', base_level: 40, ends_at: null },
  { role_id: 'cr', name: 'Creator plus', base_level: 35, ends_at: null },
];
const asList = (ceiling: number) => inviteRoleOptions(ceiling, matrix, NOW).map((r) => r.label);
assert.deepEqual(asList(40), ['Bartender', 'Drink Creator', 'Employee', 'Creator plus', 'Guest shift', 'Takeover bartender', 'Admin']);
// Below Admin: no Admin, no Admin-level role; below Drink Creator, no role above the inviter.
assert.deepEqual(asList(35), ['Bartender', 'Drink Creator', 'Employee', 'Creator plus', 'Guest shift', 'Takeover bartender']);
assert.deepEqual(asList(30), ['Bartender', 'Employee', 'Guest shift', 'Takeover bartender']);
assert.deepEqual(inviteRoleOptions(40, undefined, NOW).map((r) => r.label), ['Bartender', 'Drink Creator', 'Employee', 'Admin']);
const takeover = inviteRoleOptions(40, matrix, NOW).find((r) => r.roleId === 'tk')!;
assert.equal(takeover.level, 30);
assert.equal(inviteRoleOptions(40, matrix, NOW).find((r) => r.roleId === 'soon')!.detail, 'Sees menus, talking points and where things live, until 5 Dec');

// --- the team in its groups (Kept-team) ---
const team = [
  { display_name: 'Zed', email: 'z@bar.test', role_level: 30 },
  { display_name: 'Ada', email: 'a@bar.test', role_level: 35 },
  { display_name: 'Mo', email: 'm@bar.test', role_level: 40 },
  { display_name: 'Bea', email: 'b@bar.test', role_level: 10 },
  { display_name: 'Cy', email: 'c@bar.test', role_level: 30, venue_role_name: 'Head bartender' },
  { display_name: 'Al', email: 'al@bar.test', role_level: 40 },
  { display_name: 'Di', email: 'd@bar.test', role_level: 20 },
  { display_name: 'Mika', email: 'k@bar.test', role_level: 30, venue_role_name: 'Takeover bartender', role_ends_at: '2026-11-07T23:59:00Z' },
];
const heads = new Set(['Cy']);
const grouped = teamSections(team, (p) => heads.has(personName(p)), NOW).map((g) => [g.title, g.people.map(personName)]);
assert.deepEqual(grouped, [
  ['Admins', ['Al', 'Mo', 'Cy']],
  ['Behind the bar', ['Ada', 'Zed']],
  ['Guests', ['Mika']],
  ['Floor', ['Di', 'Bea']],
]);
assert.deepEqual(teamSections([], () => false, NOW), []);
// A guest stays a guest even with staff; an Admin is with the Admins whatever the matrix says.
assert.equal(teamGroup({ display_name: 'G', email: null, role_level: 30, role_ends_at: '2026-11-07T00:00:00Z' }, true, NOW), 'guests');
assert.equal(teamGroup({ display_name: 'G', email: null, role_level: 30, role_ends_at: '2026-10-07T00:00:00Z' }, false, NOW), 'bar');
assert.equal(teamGroup({ display_name: 'A', email: null, role_level: 40 }, false, NOW), 'admins');

assert.equal(teamLine(team[0], 'bar', true, null), 'Bartender · on shift tonight');
assert.equal(teamLine(team[1], 'bar', false, null), 'Drink Creator');
assert.equal(teamLine(team[7], 'guests', false, 'Fri 7 Nov'), 'Takeover bartender · until Fri 7 Nov');
assert.equal(teamLine(team[7], 'guests', true, 'Fri 7 Nov'), 'On shift tonight · until Fri 7 Nov');

assert.equal(canOpenMember({ user_id: 'a', role_level: 30 }, 'a', 40), false);
assert.equal(canOpenMember({ user_id: 'a', role_level: 40 }, 'b', 35), false);
assert.equal(canOpenMember({ user_id: 'a', role_level: 30 }, 'b', 35), true);
assert.equal(canOpenMember({ user_id: 'a', role_level: 40 }, 'b', 40), true);
assert.equal(teamLine(team[6], 'floor', false, null), 'Employee · menus and allergens');
assert.equal(teamLine(team[4], 'admins', true, null), 'Head bartender · on shift tonight');

const at = Date.parse('2026-11-06T20:00:00Z');
assert.equal(askedAgo('2026-11-06T19:40:00Z', at), '20 minutes ago');
assert.equal(askedAgo('2026-11-06T19:59:30Z', at), 'just now');
assert.equal(askedAgo('2026-11-06T17:00:00Z', at), '3 hours ago');
assert.equal(askedAgo('2026-11-05T19:00:00Z', at), 'yesterday');
assert.equal(askedAgo('2026-11-02T19:00:00Z', at), '4 days ago');

// --- days, in local time ---
const now = new Date(2026, 10, 6, 15, 0).getTime(); // Fri 6 Nov 2026, 3pm
assert.equal(invitedDay(new Date(2026, 10, 6, 9).toISOString(), now), 'today');
assert.equal(invitedDay(new Date(2026, 10, 5, 22).toISOString(), now), 'yesterday');
assert.equal(invitedDay(new Date(2026, 10, 3, 12).toISOString(), now), 'Tuesday');
assert.equal(invitedDay(new Date(2026, 9, 20, 12).toISOString(), now), '20 Oct');
assert.equal(invitedDay(null, now), null);
assert.equal(nextShiftLabel(new Date(2026, 10, 6, 18).toISOString(), now), 'Tonight');
assert.equal(nextShiftLabel(new Date(2026, 10, 7, 18).toISOString(), now), 'Sat');
assert.equal(nextShiftLabel(new Date(2026, 10, 20, 18).toISOString(), now), '20 Nov');
assert.equal(sinceLabel({ role_since: '2025-03-12T00:00:00Z', joined_at: '2024-01-01T00:00:00Z' }), 'since March 2025');
assert.equal(sinceLabel({ joined_at: '2024-01-01T00:00:00Z' }), 'since January 2024');
assert.equal(sinceLabel({}), null);
