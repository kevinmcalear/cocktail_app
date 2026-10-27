// Checks for lib/venueSetup.ts (venue setup, b03 and b19). Run: npm run test:unit
import assert from 'node:assert/strict';

import { inviteRowError, namesLine, nextScreen, normalizeWebsite, onItsWay, openRun, previousScreen, resumeScreen, sendInvitesLabel, startedSetup, venueProgress } from './venueSetup';

// Intro, finding the bar, four steps, the checklist. No role step and no Bring in (owner-setup call 4); proving it's yours is the checklist's card (E32), and its screen comes back there.
assert.equal(nextScreen('intro'), 'find');
assert.equal(nextScreen('find'), 'place');
assert.equal(nextScreen('visibility'), 'done');
assert.equal(nextScreen('claim'), 'done');
assert.equal(previousScreen('find'), 'intro');
assert.equal(previousScreen('place'), 'find');
assert.equal(previousScreen('claim'), 'visibility');
assert.equal(previousScreen('done'), 'visibility');
assert.equal(venueProgress('find'), null);
assert.deepEqual(venueProgress('place'), { at: 1, of: 3, label: 'Step 1 of 3', name: 'Venue setup' });
assert.deepEqual(venueProgress('visibility'), { at: 3, of: 3, label: 'Step 3 of 3', name: 'Venue setup' });
assert.equal(venueProgress('claim'), null, 'the claim is not a step');
assert.equal(venueProgress('intro'), null);
assert.equal(venueProgress('done'), null);

// Picking up: the first step not done; with all of them done, the checklist (never the claim). Old runs' 'role' and 'bring' don't count.
assert.equal(resumeScreen([]), 'find');
assert.equal(resumeScreen(['find', 'role']), 'place');
assert.equal(resumeScreen(['find', 'place', 'look', 'visibility']), 'done');
// Runs from before 26 Oct may have done the team step: it isn't one any more.
assert.equal(resumeScreen(['find', 'place', 'look', 'visibility', 'team']), 'done');
assert.equal(resumeScreen(['find', 'place', 'look', 'visibility', 'team', 'claim']), 'done');

// Where setup opens. ?bar=: that venue's run, or its claim.
assert.deepEqual(openRun({ bar: 'b1', step: 'claim' }, {}), { key: 'b1', screen: 'claim' });
assert.deepEqual(openRun({ bar: 'b1' }, { b1: { done: ['find', 'place'] } }), { key: 'b1', screen: 'look' });
// ?claim=: straight into Where and when; a bar already started opens where it stopped.
assert.deepEqual(openRun({ claim: 'p1' }, {}), { key: 'new', screen: 'place' });
assert.deepEqual(openRun({ claim: 'p1' }, { new: { profileId: 'p2', done: ['find', 'place'] } }), { key: 'new', screen: 'place' });
// The home menu's Run a bar? Set it up opens at Find your bar, unless a setup already started.
assert.deepEqual(openRun({ step: 'find' }, {}), { key: 'new', screen: 'find' });
assert.deepEqual(openRun({}, {}), { key: 'new', screen: 'intro' });
assert.deepEqual(openRun({ claim: 'p1' }, { b9: { profileId: 'p1', done: ['find', 'place', 'look'] } }), { key: 'b9', screen: 'visibility' });
assert.deepEqual(openRun({ claim: 'p1' }, { b9: { profileId: 'p1', done: ['place'], finished: true } }), { key: 'new', screen: 'place' });
// Neither: a setup left before its venue was made, else the intro.
assert.deepEqual(openRun({}, { new: { done: ['find'] } }), { key: 'new', screen: 'place' });
assert.deepEqual(openRun({}, { new: { done: [] } }), { key: 'new', screen: 'intro' });
assert.deepEqual(openRun({}, {}), { key: 'new', screen: 'intro' });

// Settings › Create a venue opens the setup already started (owner-setup call 5).
assert.equal(startedSetup({}), null);
assert.equal(startedSetup({ b1: { done: ['find'], finished: true } }), null);
assert.equal(startedSetup({ b1: { done: ['find', 'place'] } }), '/venue-setup?bar=b1');
assert.equal(startedSetup({ new: { done: ['find'] } }), '/venue-setup');
assert.equal(startedSetup({ new: { done: [] } }), null);

// Tonight's banner counts what's on its way.
assert.equal(onItsWay({ claim: 'pending', invites: 3 }), 2);
assert.equal(onItsWay({ claim: 'approved', invites: 0 }), 0);

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
