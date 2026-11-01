// Checks for lib/stepNotes.ts: the words on a drink's steps, what a save
// writes and clears, and words following their part. Run: npm run test:unit
import assert from 'node:assert/strict';

import type { DraftPart } from './drinkParts';
import type { SortableRecipeItem } from './recipeItem';
import { carryFloatWords, draftSteps, moveStepDraft, noteLeft, NOTE_MAX, stepDraft, stepNoteChanges } from './stepNotes';

const line = (key: string, unit: string, extra: Partial<SortableRecipeItem> = {}) => ({ key, ingredient_id: key, name: key, amount: '1', unit, ...extra }) as SortableRecipeItem;
const penicillin = [line('scotch', 'ml'), line('lemon', 'ml'), line('islay', 'ml', { is_float: true }), line('ginger', 'each')];

// The editor's steps are the page's: main by its verb, the float, the garnish last.
assert.deepEqual(draftSteps(penicillin, null, 'Shake').map((g) => [g.key, g.title]), [['main', 'Shake'], ['float', 'Float'], ['garnish', null]]);
// In parts, the first part keeps main's words; the next is part-2.
const parts: DraftPart[] = [
  { name: 'Base', lines: ['scotch', 'lemon'], methods: [] },
  { name: 'Top', join: 'float', lines: ['islay'], methods: [] },
];
assert.deepEqual(draftSteps(penicillin, parts, 'Shake').map((g) => g.key), ['main', 'part-2', 'garnish']);
// A part with no lines of its own doesn't pass its key on: part 2 stays part-2.
const empty: DraftPart[] = [{ name: 'Base', lines: [], methods: [] }, { name: 'Mid', lines: ['scotch', 'lemon'], methods: [] }, { name: 'Top', lines: ['islay'], methods: [] }];
assert.deepEqual(draftSteps(penicillin, empty, 'Shake').map((g) => g.key), ['part-2', 'part-3', 'garnish']);
// A unit with stray spaces is the same garnish the page finds.
assert.deepEqual(draftSteps([line('scotch', 'ml'), line('ginger', ' each ')], null, null).map((g) => g.key), ['main', 'garnish']);

// A part's own name is its step's name; a blank one reads Part 2; the first part's method still names it.
assert.deepEqual(draftSteps(penicillin, parts, 'Shake').map((g) => g.title), ['Shake', 'Top', null]);
assert.deepEqual(draftSteps(penicillin, parts, null).map((g) => g.title), ['Base', 'Top', null]);
assert.equal(draftSteps(penicillin, [parts[0], { ...parts[1], name: ' ' }], 'Shake')[1].title, 'Part 2');
// Each step lists what's in it.
assert.deepEqual(draftSteps(penicillin, null, 'Shake')[0].lines.map((l) => l.name), ['scotch', 'lemon']);

// The count shows near the limit (the board's 42 left), not before.
assert.equal(noteLeft('x'.repeat(NOTE_MAX - 51)), null);
assert.equal(noteLeft('x'.repeat(NOTE_MAX - 42)), '42 left');

// Loading: nulls read as empty boxes.
const stored = [
  { step_key: 'main', aside: 'hard, with ice', note: null },
  { step_key: 'float', aside: null, note: 'Over the back of a bar spoon.' },
];
const draft = stepDraft(stored);
assert.deepEqual(draft.main, { aside: 'hard, with ice', note: '' });

// Nothing typed: nothing to write.
assert.equal(stepNoteChanges(stored, draft, ['main', 'float', 'garnish']), null);
// Typed words are trimmed; a step emptied is cleared, not saved blank.
const typed = { ...draft, main: { aside: '  hard, with ice ', note: 'Strain over one large cube.' }, float: { aside: '', note: '  ' } };
assert.deepEqual(stepNoteChanges(stored, typed, ['main', 'float', 'garnish']), {
  rows: [{ step_key: 'main', aside: 'hard, with ice', note: 'Strain over one large cube.' }],
  gone: ['float'],
});
// A step the drink no longer has takes its words with it.
assert.deepEqual(stepNoteChanges(stored, draft, ['main', 'garnish']), { rows: [{ step_key: 'main', aside: 'hard, with ice', note: null }], gone: ['float'] });

// Parts moved: each part's words go with it; words on steps that aren't parts stay.
const three = { main: { aside: 'a', note: '' }, 'part-2': { aside: 'b', note: '' }, 'part-3': { aside: 'c', note: '' }, garnish: { aside: '', note: 'g' } };
assert.deepEqual(moveStepDraft(three, [1, 0, 2], 3), { garnish: three.garnish, main: three['part-2'], 'part-2': three.main, 'part-3': three['part-3'] });
// A part removed: its words go, the ones after move up.
assert.deepEqual(moveStepDraft(three, [0, 2], 3), { garnish: three.garnish, main: three.main, 'part-2': three['part-3'] });

// Float lines moved into a part: the Float step's words follow them, joined after any the part has.
const floatWords = { float: { aside: 'over the back of a spoon', note: 'Pour slowly.' }, garnish: { aside: '', note: 'g' } };
const parted = draftSteps(penicillin, parts, 'Shake');
assert.deepEqual(carryFloatWords(floatWords, parted), { garnish: floatWords.garnish, 'part-2': { aside: 'over the back of a spoon', note: 'Pour slowly.' } });
assert.deepEqual(carryFloatWords({ ...floatWords, 'part-2': { aside: 'cold', note: 'Chill first.' } }, parted)['part-2'], { aside: 'cold · over the back of a spoon', note: 'Chill first.\n\nPour slowly.' });
// An aside too long to join goes into the note; the part's own stays the aside.
const long = 'x'.repeat(40);
assert.deepEqual(carryFloatWords({ float: { aside: 'y'.repeat(30), note: '' }, 'part-2': { aside: long, note: '' } }, parted)['part-2'], { aside: long, note: 'y'.repeat(30) });
// Still a Float step (no drink in parts, or every line back in part 1), or no float line left: nothing moves.
const intoMain = draftSteps(penicillin, [{ name: '', lines: ['scotch', 'lemon', 'islay'], methods: [] }, { name: '', lines: [], methods: [] }], 'Shake');
assert.equal(carryFloatWords(floatWords, intoMain), floatWords);
assert.equal(carryFloatWords(floatWords, draftSteps(penicillin, null, 'Shake')), floatWords);
assert.equal(carryFloatWords(floatWords, draftSteps(penicillin.filter((l) => !l.is_float), parts, 'Shake')), floatWords);
// Together they save: the Float row is cleared, the part's written.
assert.deepEqual(stepNoteChanges([{ step_key: 'float', aside: 'a', note: null }], carryFloatWords({ float: { aside: 'a', note: '' } }, parted), parted.map((g) => g.key)), { rows: [{ step_key: 'part-2', aside: 'a', note: null }], gone: ['float'] });

console.log('stepNotes checks passed');
