// Checks for lib/venueSetup.ts (venue setup, b03 and b19). Run: npm run test:unit
import assert from 'node:assert/strict';

import { afterClaim, inviteRowError, namesLine, nextScreen, normalizeWebsite, onItsWay, previousScreen, resumeScreen, sendInvitesLabel, venueProgress } from './venueSetup';

// Intro, eight steps, summary. Proving it's yours is the last step.
assert.equal(nextScreen('intro'), 'find');
assert.equal(nextScreen('find'), 'role');
assert.equal(nextScreen('team'), 'claim');
assert.equal(nextScreen('claim'), 'done');
assert.equal(previousScreen('find'), 'intro');
assert.equal(previousScreen('role'), 'find');
assert.equal(previousScreen('claim'), 'team');
assert.equal(previousScreen('done'), 'claim');
assert.deepEqual(venueProgress('find'), { at: 1, of: 8, label: 'Step 1 of 8', name: 'Venue setup' });
assert.deepEqual(venueProgress('place'), { at: 3, of: 8, label: 'Step 3 of 8', name: 'Venue setup' });
assert.deepEqual(venueProgress('claim'), { at: 8, of: 8, label: 'Step 8 of 8', name: 'Venue setup' });
assert.equal(venueProgress('intro'), null);
assert.equal(venueProgress('done'), null);

// Picking up from Tonight: the first step not done. Kept private, that's the claim.
assert.equal(resumeScreen([]), 'find');
assert.equal(resumeScreen(['find', 'role']), 'place');
assert.equal(resumeScreen(['find', 'role', 'place', 'look', 'visibility', 'bring', 'team']), 'claim');
assert.equal(resumeScreen(['find', 'role', 'place', 'look', 'visibility', 'bring', 'team', 'claim']), 'done');

// After the claim: the summary, unless it was opened from a bar page before any setup.
assert.equal(afterClaim(['find', 'role', 'place'], false), 'done');
assert.equal(afterClaim([], true), 'role');
assert.equal(afterClaim(['find', 'role', 'place', 'look', 'visibility', 'bring', 'team'], true), 'done');

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
