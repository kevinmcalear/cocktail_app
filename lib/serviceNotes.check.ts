// Checks for lib/serviceNotes.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { cleanServiceNotes, EMPTY_SERVICE_NOTES, handoffSteps, handoffText, hasServiceNotes, hasTalkingPoints } from './serviceNotes';

// Blanks go, text is trimmed, empty steps are dropped and the list is capped at eight.
const cleaned = cleanServiceNotes({
  garnish: '  Candied ginger on a pick  ',
  handoff: ['Coaster down first', '', '   ', ...Array.from({ length: 10 }, (_, i) => ` Step ${i + 2} `)],
  talkingPoint: '   ',
  sellItAs: 'Smoky, spicy, bright.',
});
assert.equal(cleaned.garnish, 'Candied ginger on a pick');
assert.equal(cleaned.talkingPoint, null);
assert.equal(cleaned.handoff.length, 8);
assert.deepEqual(cleaned.handoff.slice(0, 2), ['Coaster down first', 'Step 2']);

// Something to show, and the floor's part on its own.
assert.equal(hasServiceNotes(EMPTY_SERVICE_NOTES), false);
assert.equal(hasServiceNotes(null), false);
assert.equal(hasServiceNotes({ ...EMPTY_SERVICE_NOTES, handoff: ['Coaster down'] }), true);
assert.equal(hasTalkingPoints({ ...EMPTY_SERVICE_NOTES, garnish: 'A twist' }), false);
assert.equal(hasTalkingPoints({ ...EMPTY_SERVICE_NOTES, sellItAs: 'Bright' }), true);

// One box, a step per line, round trips.
assert.deepEqual(handoffSteps(handoffText(['One', 'Two'])), ['One', 'Two']);
