import assert from 'node:assert/strict';

import { askedBy, deleteDay, nameMatches, otherAdmins, whatGoes, whatStays } from './venueDelete';

// --- the typed name, as delete_venue compares it ---
assert.ok(nameMatches('little rye', 'Little Rye'), 'capitals don’t matter');
assert.ok(nameMatches('  Little Rye ', 'Little Rye'), 'spaces at the ends don’t matter');
assert.ok(!nameMatches('Little', 'Little Rye'));
assert.ok(!nameMatches('', ''), 'an empty name never matches');

// --- the day ---
assert.equal(deleteDay('2026-11-02T18:00:00Z'), 'Mon 2 Nov');

// --- the lists, with the team's count ---
assert.equal(whatGoes('Little Rye', 11)[0], 'Little Rye for your team: 11 people lose it, with its roles, invites and join requests');
assert.equal(whatGoes('Solo', 1)[0], 'Solo for your team: 1 person loses it, with its roles, invites and join requests');
assert.equal(whatGoes('Little Rye').length, 5);
assert.equal(whatStays('Little Rye')[3], 'Awards, the people who worked here, and rankings at Little Rye');

// --- who asked, and who else can undo it ---
const team = [
  { user_id: 'kevin', display_name: 'Kevin McAlear', role_level: 40 },
  { user_id: 'rob', display_name: 'Rob Ng', role_level: 40 },
  { user_id: 'jo', display_name: 'Jo Park', role_level: 30 },
];
assert.equal(askedBy('kevin', 'kevin', team), 'You');
assert.equal(askedBy('kevin', 'rob', team), 'Kevin McAlear');
assert.equal(askedBy('gone', 'rob', team), 'An Admin');
assert.equal(askedBy(null, 'rob', team), 'An Admin');
assert.deepEqual(otherAdmins('kevin', team), ['Rob']);

console.log('venueDelete checks passed');
