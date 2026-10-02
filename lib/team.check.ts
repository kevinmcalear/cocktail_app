import assert from 'node:assert/strict';

import { canManageTeam, canSeeTeam, joinedLabel, personName, roster, TEAM_MANAGE, TEAM_SEE } from './team';

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
