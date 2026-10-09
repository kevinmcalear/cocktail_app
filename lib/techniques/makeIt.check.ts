// Checks for lib/techniques/makeIt.ts and needsFoamer. Run: npm run test:unit
import assert from 'node:assert/strict';

import { PREP_ACTIONS } from '../scale';
import { needsFoamer } from './foamPicker';
import { techniqueById, TECHNIQUES } from './index';
import { actionFor, prepCardFor, waysToMake } from './makeIt';

const ids = (name: string) => waysToMake(name).map((t) => t.id);

// A typed prep finds the techniques that make it, most likely first, no repeats.
assert.equal(ids('Clarified grapefruit')[0], 'agar-quick');
assert.equal(ids('Clarified milk punch')[0], 'milk-wash');
assert.equal(new Set(ids('Clarified milk punch')).size, ids('Clarified milk punch').length);
assert.deepEqual(ids('Brown butter bourbon'), ['fat-wash']);
assert.ok(ids('Ginger foam').includes('siphon-foam'));
assert.equal(ids('Methylcellulose sour syrup')[0], 'sour-syrup');
assert.deepEqual(ids('Saline'), ['saline']);
assert.deepEqual(ids('Lime juice'), []);
assert.deepEqual(ids('  '), []);

// Every technique's tag is one the prep editor offers, so cards made here edit cleanly.
for (const t of TECHNIQUES) assert.ok((PREP_ACTIONS as readonly string[]).includes(actionFor(t)), `${t.id} → ${actionFor(t)}`);
assert.equal(actionFor(techniqueById('milk-wash')!), 'Milk wash');
assert.equal(actionFor(techniqueById('agar-quick')!), 'Clarify');

// The card leads with the amounts for its usual batch, keeps the timers, and points back to the library.
const card = prepCardFor(techniqueById('agar-quick')!);
assert.deepEqual(card.actions, ['Clarify']);
assert.equal(card.steps[0].body, 'For 375 g juice: 125 g water, 1 g agar.');
assert.ok(card.steps.some((s) => s.timer_seconds === 120));
assert.match(card.steps.at(-1)!.body, /Quick agar clarifying in Techniques/);
assert.equal(card.leadMinutes, 30);
for (const t of TECHNIQUES) for (const s of prepCardFor(t).steps) assert.ok(s.body.length <= 500, `${t.id} step fits item_steps`);

// A dry shake with nothing that foams asks for a foamer; one with egg white doesn't.
assert.equal(needsFoamer(['Dry shake', 'Shake'], ['Gin', 'Lemon juice']), true);
assert.equal(needsFoamer(['Reverse dry shake'], ['Gin', 'Egg white']), false);
assert.equal(needsFoamer(['Shake'], ['Gin']), false);
assert.equal(needsFoamer(['Dry shake'], ['Methylcellulose sour syrup']), false);

console.log('makeIt.check: ok');
