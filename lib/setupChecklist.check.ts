import assert from 'node:assert/strict';

import { checklist, checklistEyebrow, lookSet, menuLine, placeSet } from './setupChecklist';

const none = { claim: false, menu: false, where: false, glassware: false, team: false, visibility: false, theme: false, calendars: false };

// --- the eight rows, as drawn (Kept-onboard, Owner after the three steps) ---
let list = checklist({ ...none, claim: true, menu: true, where: true });
assert.deepEqual(
  list.rows.map((r) => r.title),
  ['Claim it', 'Tonight’s menu', 'Where and when', 'Glassware from your drinks', 'Invite your team', 'Who sees your page', 'Theme', 'Calendars']
);
assert.equal(checklistEyebrow(list), 'Owner · 3 of 8 done');
assert.equal(list.next, 'glassware');
assert.equal(list.rows.find((r) => r.key === 'glassware')?.state, 'now');
assert.equal(list.finished, false);

// --- skips, and Calendars never holds it open ---
list = checklist({ ...none, claim: true, menu: true, where: true, theme: true, visibility: true }, ['glassware', 'team']);
assert.equal(list.next, 'calendars', 'only the optional row is left');
assert.equal(list.finished, true, 'the rest done or skipped: it leaves the top of the bar');
assert.equal(list.rows.find((r) => r.key === 'team')?.state, 'skipped');
assert.equal(checklist({ ...none }, ['kit']).rows.find((r) => r.key === 'glassware')?.state, 'skipped', 'an old Kit skip is the glassware row');
assert.equal(checklist({ ...none, calendars: true }).next, 'claim', 'Calendars done early still leaves the rest first');
assert.equal(checklist({ claim: true, menu: true, where: true, glassware: true, team: true, visibility: true, theme: true, calendars: true }).next, null);

// --- lines ---
assert.equal(menuLine('Winter', 4), 'Winter · 4 drinks');
assert.equal(menuLine('Winter', 1), 'Winter · 1 drink');

// --- Where and when: venue setup got past it, or there's no setup here ---
assert.equal(placeSet(undefined), true);
assert.equal(placeSet({ done: ['find'], finished: false }), false);
assert.equal(placeSet({ done: ['find', 'place'], finished: false }), true);
assert.equal(placeSet({ done: [], finished: true }), true);

// --- the look Your team waits for, and Theme's tick ---
const bare = { logo_url: null, primary_color: null, display_face: 'instrument_serif' };
assert.equal(lookSet(bare), false);
assert.equal(lookSet({ ...bare, primary_color: '#D0643B' }), true);
assert.equal(lookSet({ ...bare, logo_url: 'https://x/logo.png' }), true);
assert.equal(lookSet({ ...bare, display_face: 'fraunces' }), true);
assert.equal(lookSet(bare, { done: ['find', 'place', 'look'] }), true);

console.log('setupChecklist.check: ok');
