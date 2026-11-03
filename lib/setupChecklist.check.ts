// Checks for lib/setupChecklist.ts (board Kept-onboard, the owner's checklist). Run: npm run test:unit
import assert from 'node:assert/strict';

import { checklist, checklistEyebrow, kitNote, lookSet, menuNote, setupStepDone } from './setupChecklist';

const none = { claim: false, menu: false, place: false, glass: false, team: false, visibility: false, theme: false, calendars: false };

// Fresh: Claim it first, nothing done.
let list = checklist(none);
assert.equal(list.next, 'claim');
assert.equal(list.rows.length, 8);
assert.equal(list.rows[0].state, 'now');
assert.equal(checklistEyebrow(list), 'Owner · 0 of 8 done');

// As drawn: the three steps done, Glassware next.
list = checklist({ ...none, claim: true, menu: true, place: true });
assert.equal(list.next, 'glass');
assert.deepEqual(list.rows.map((r) => r.state), ['done', 'done', 'done', 'now', 'todo', 'todo', 'todo', 'todo']);
assert.equal(checklistEyebrow(list), 'Owner · 3 of 8 done');
assert.deepEqual(list.rows.map((r) => r.title), ['Claim it', 'Tonight’s menu', 'Where and when', 'Glassware from your drinks', 'Invite your team', 'Who sees your page', 'Theme', 'Calendars']);

// Skipped rows don't hold it open, and Calendars is optional.
list = checklist({ ...none, claim: true, menu: true, place: true, glass: true, visibility: true, theme: true }, ['team']);
assert.equal(list.finished, true);
assert.equal(list.next, 'calendars');
assert.equal(list.rows[4].state, 'skipped');
assert.equal(checklist({ ...none, claim: true }).finished, false);

// The menu row: "Winter · 4 drinks".
assert.equal(menuNote(undefined), undefined);
assert.equal(menuNote({ name: 'Winter', itemIds: [1, 2, 3, 4] }), 'Winter · 4 drinks');
assert.equal(menuNote({ name: 'Winter', itemIds: [1] }), 'Winter · 1 drink');
assert.equal(menuNote({ name: 'Winter', itemIds: [] }), 'Winter');

// Venue setup steps: done on this device, or set up elsewhere.
assert.equal(setupStepDone(undefined, 'place'), true);
assert.equal(setupStepDone({ done: ['find'] }, 'place'), false);
assert.equal(setupStepDone({ done: ['find', 'place'] }, 'place'), true);

// The glassware row's note: glasses, ice and tools, the empty ones left out.
assert.equal(kitNote(0, 0, 0), undefined);
assert.equal(kitNote(2, 0, 0), '2 glasses so far');
assert.equal(kitNote(1, 2, 1), '1 glass, 2 ice, 1 tool so far');

// Theme: a logo, a colour, a changed font, or How it looks done in venue setup.
const bare = { logo_url: null, primary_color: null, display_face: 'instrument_serif' };
assert.equal(lookSet(bare), false);
assert.equal(lookSet({ ...bare, primary_color: '#D0643B' }), true);
assert.equal(lookSet({ ...bare, logo_url: 'https://x/logo.png' }), true);
assert.equal(lookSet({ ...bare, display_face: 'besley' }), true);
assert.equal(lookSet(bare, { done: ['find', 'place', 'look'] }), true);
