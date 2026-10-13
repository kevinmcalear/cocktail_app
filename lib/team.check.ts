import assert from 'node:assert/strict';

import { canManageTeam, canSeeTeam, INVITE_ROLES, inviteButtonLabel, joinedLabel, personName, roster, rosterGroups, TEAM_MANAGE, TEAM_SEE, TEAM_SORTS } from './team';

assert.equal(TEAM_SEE, 20);
assert.equal(TEAM_MANAGE, 40);
assert.equal(canSeeTeam(10), false);
assert.equal(canSeeTeam(20), true);
assert.equal(canManageTeam(35), false);
assert.equal(canManageTeam(40), true);

assert.equal(personName({ display_name: ' Ada ', email: 'ada@bar.test' }), 'Ada');
assert.equal(personName({ display_name: '', email: 'ada@bar.test' }), 'ada');
assert.equal(personName({ display_name: null, email: null }), 'Team member');
assert.equal(joinedLabel('2026-03-04T00:00:00Z'), 'Joined 4 Mar 2026');
assert.equal(joinedLabel(null), null);

const people = [
  { display_name: 'Jo', email: 'jo@bar.test' },
  { display_name: 'Ada', email: 'ada@bar.test' },
  { display_name: null, email: 'sam@bar.test' },
];
assert.deepEqual(roster(people, '').map(personName), ['Ada', 'Jo', 'sam']);
assert.deepEqual(roster(people, '  JO ').map(personName), ['Jo']);
assert.deepEqual(roster(people, 'sam@').map(personName), ['sam']);
assert.deepEqual(roster(people, 'nobody'), []);

assert.deepEqual(INVITE_ROLES.map((r) => r.level), [20, 30, 35, 40]);
assert.equal(inviteButtonLabel('  Sam Okafor '), 'Email Sam an invite');
assert.equal(inviteButtonLabel(''), 'Email an invite');

// --- sorting the roster ---
const team = [
  { display_name: 'Zed', email: 'z@bar.test', role_level: 30 },
  { display_name: 'Ada', email: 'a@bar.test', role_level: 30 },
  { display_name: 'Mo', email: 'm@bar.test', role_level: 40 },
  { display_name: 'Bea', email: 'b@bar.test', role_level: 10 },
  { display_name: 'Cy', email: 'c@bar.test', role_level: 30, venue_role_name: 'Head bartender' },
  { display_name: 'Al', email: 'al@bar.test', role_level: 40 },
  { display_name: 'Di', email: 'd@bar.test', role_level: 20 },
];
const titled = (sort: 'role' | 'name', q = '') => rosterGroups(team, q, sort).map((g) => [g.title, g.people.map(personName)]);
assert.deepEqual(titled('role'), [
  ['Admin', ['Al', 'Mo']],
  ['Bartender', ['Ada', 'Zed']],
  ['Head bartender', ['Cy']],
  ['Employee', ['Di']],
  ['Guest', ['Bea']],
]);
assert.deepEqual(titled('name'), [[null, ['Ada', 'Al', 'Bea', 'Cy', 'Di', 'Mo', 'Zed']]]);
assert.deepEqual(titled('role', 'd'), [['Bartender', ['Ada', 'Zed']], ['Employee', ['Di']]]);
assert.deepEqual(rosterGroups(team, 'nobody', 'role'), []);
assert.deepEqual(rosterGroups(team, 'nobody', 'name'), []);
assert.deepEqual(TEAM_SORTS.map((s) => s.value), ['role', 'name']);
