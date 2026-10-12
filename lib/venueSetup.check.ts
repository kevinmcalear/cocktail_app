// Checks for lib/venueSetup.ts (venue setup, b03 and b19). Run: npm run test:unit
import assert from 'node:assert/strict';

import { inviteRowError, namesLine, nextScreen, normalizeWebsite, onItsWay, previousScreen, resumeScreen, sendInvitesLabel, venueProgress } from './venueSetup';

// Intro, eight steps, summary.
assert.equal(nextScreen('intro'), 'find');
assert.equal(nextScreen('find'), 'claim');
assert.equal(nextScreen('team'), 'done');
assert.equal(previousScreen('find'), 'intro');
assert.equal(previousScreen('claim'), 'find');
assert.equal(previousScreen('done'), 'team');
assert.deepEqual(venueProgress('find'), { at: 1, of: 8, label: 'Step 1 of 8', name: 'Venue setup' });
assert.deepEqual(venueProgress('place'), { at: 4, of: 8, label: 'Step 4 of 8', name: 'Venue setup' });
assert.equal(venueProgress('intro'), null);
assert.equal(venueProgress('done'), null);

// Picking up from Tonight: the first step not done, even with the claim still waiting.
assert.equal(resumeScreen([]), 'find');
assert.equal(resumeScreen(['find', 'claim', 'role']), 'place');
assert.equal(resumeScreen(['find', 'claim', 'role', 'place', 'look', 'visibility', 'bring', 'team']), 'done');

// Tonight's banner counts what's on its way.
assert.equal(onItsWay({ claim: 'pending', invites: 3, waitingFiles: 1 }), 3);
assert.equal(onItsWay({ claim: 'approved', invites: 0, waitingFiles: 0 }), 0);

assert.equal(namesLine(['Sam', 'Mia', 'Tom']), 'Sam, Mia and Tom');
assert.equal(namesLine(['Sam']), 'Sam');
assert.equal(sendInvitesLabel(3), 'Send 3 invites');
assert.equal(sendInvitesLabel(1), 'Send the invite');
assert.equal(inviteRowError({ email: '' }), 'Add their email.');
assert.equal(inviteRowError({ email: 'sam@' }), 'That email doesn’t look right.');
assert.equal(inviteRowError({ email: ' sam@example.com ' }), null);
assert.equal(normalizeWebsite('littlerye.com.au'), 'https://littlerye.com.au');
assert.equal(normalizeWebsite('http://x.com'), 'http://x.com');
assert.equal(normalizeWebsite('  '), null);
