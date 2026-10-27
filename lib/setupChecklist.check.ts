// Checks for lib/setupChecklist.ts (owner-setup step 5). Run: npm run test:unit
import assert from 'node:assert/strict';

import { barSetUp, checklist, checklistIntro, drinksNote, kitNote, lookSet } from './setupChecklist';

const none = { bar: false, kit: false, bottles: false, menu: false, drinks: false, team: false };

// Fresh: Your bar is first, nothing done.
let list = checklist(none);
assert.equal(list.next, 'bar');
assert.deepEqual(list.rows.map((r) => r.state), ['now', 'todo', 'todo', 'todo', 'todo', 'todo']);
assert.equal(checklistIntro(list), 'Six things to set up. Each one brings you back here.');

// As drawn: the bar done, Kit next, the team skipped.
list = checklist({ ...none, bar: true }, ['team']);
assert.equal(list.next, 'kit');
assert.deepEqual(list.rows.map((r) => r.state), ['done', 'now', 'todo', 'todo', 'todo', 'skipped']);
assert.equal(list.done, 1);
assert.equal(checklistIntro(list), 'One of six done. Each one brings you back here.');

// A skipped row done later counts as done; done or skipped everywhere finishes it.
list = checklist({ bar: true, kit: true, bottles: true, menu: true, drinks: false, team: true }, ['team', 'drinks']);
assert.equal(list.finished, true);
assert.equal(list.next, null);
assert.equal(list.done, 5);
assert.equal(checklist({ ...none, bar: true, kit: true, bottles: true }).done, 3);
assert.equal(checklistIntro({ done: 3, total: 6 }), 'Three of six done. Each one brings you back here.');

// Your bar: venue setup past who sees what.
assert.equal(barSetUp(undefined), false);
assert.equal(barSetUp({ done: ['find', 'place'], finished: false }), false);
assert.equal(barSetUp({ done: ['find', 'place', 'look', 'visibility'], finished: false }), true);
assert.equal(barSetUp({ done: [], finished: true }), true);

// The Kit row's note: glasses, ice and tools, the empty ones left out.
assert.equal(kitNote(0, 0, 0), undefined);
assert.equal(kitNote(2, 0, 0), '2 glasses so far');
assert.equal(kitNote(1, 2, 1), '1 glass, 2 ice, 1 tool so far');
assert.equal(kitNote(0, 1, 3), '1 ice, 3 tools so far');

// First drinks (E31): what's in the Library, and what an import still has to check.
assert.equal(drinksNote(18, 28), '18 in your Library, 28 still to check');
assert.equal(drinksNote(18, 0), '18 in your Library');
assert.equal(drinksNote(0, 46), '46 still to check');
assert.equal(drinksNote(0, 0), undefined);

// Your team waits for the look: a logo, a colour, a changed font, or How it looks done in venue setup.
const bare = { logo_url: null, primary_color: null, display_face: 'instrument_serif' };
assert.equal(lookSet(bare), false);
assert.equal(lookSet({ ...bare, primary_color: '#D0643B' }), true);
assert.equal(lookSet({ ...bare, logo_url: 'https://x/logo.png' }), true);
assert.equal(lookSet({ ...bare, display_face: 'fraunces' }), true);
assert.equal(lookSet(bare, { done: ['find', 'place', 'look'] }), true);
