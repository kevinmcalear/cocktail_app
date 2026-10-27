// Editing a saved drink made in parts (drink-edit-parts): the rows the
// editor lists, where a held line lands, and moving or removing a part.
import assert from 'node:assert/strict';

import { byPart, dropEntry, movePart, partEntries, partMethodsSaid, removePart, slotPart, startParts, toggleLine, type DraftPart } from './drinkParts';
import { dragSlot } from './dropIndex';

const pick = (name: string) => ({ id: name, name });
const line = (key: string) => ({ key, id: null, name: key, amount: '', unit: 'ml' });

// An Irish Coffee: whiskey, coffee, syrup in part 1; cream floated on top.
let parts: DraftPart[] = toggleLine(startParts({ lines: ['whiskey', 'coffee', 'syrup', 'cream'].map(line), methods: [pick('Build')] }), 1, 'cream');
parts = [{ ...parts[0], name: 'The coffee' }, { ...parts[1], name: 'The cream', methods: [pick('Whip (whisk or frother)')] }];
const keys = ['whiskey', 'coffee', 'syrup', 'cream'];

// The rows: part 1's lines, then part 2's heading and its lines. One part is just the lines.
const rows = partEntries(parts, keys);
assert.deepEqual(rows, [{ line: 0 }, { line: 1 }, { line: 2 }, { part: 2 }, { line: 3 }]);
assert.deepEqual(partEntries(null, keys), keys.map((_, i) => ({ line: i })));
// Lines out of part order still list under their part.
assert.deepEqual(partEntries(parts, ['cream', 'whiskey']), [{ line: 1 }, { part: 2 }, { line: 0 }]);
// An empty part still has its heading, so a line can be dropped into it.
assert.deepEqual(partEntries([...parts, { name: '', join: 'float', lines: [], methods: [] }], keys).slice(-1), [{ part: 3 }]);

// The syrup (row 2) dropped past part 2's heading lands in part 2, before the cream.
assert.deepEqual(dropEntry(rows, 2, 3), { order: [0, 1, 2, 3], part: 2 });
// The syrup dropped at the end: after the cream, in part 2.
assert.deepEqual(dropEntry(rows, 2, 4), { order: [0, 1, 3, 2], part: 2 });
// The whiskey moved one down stays in part 1, after the coffee.
assert.deepEqual(dropEntry(rows, 0, 1), { order: [1, 0, 2, 3], part: 1 });
// The cream (row 4) moved one up crosses the heading: the end of part 1.
assert.deepEqual(dropEntry(rows, 4, 3), { order: [0, 1, 2, 3], part: 1 });
// Where the gap is says the part the tag names ("Move to The cream").
assert.equal(slotPart(rows, 2, 2), 1);
assert.equal(slotPart(rows, 2, 3), 2);

// Dragged with the drop math the list uses: rows 60 tall, the heading (with the Add field above it) 120.
const heights = [60, 60, 60, 120, 60];
// The syrup held 100 down is over the heading: not a line, so nothing combines (useCombineDrop), and it's still in part 1.
const overHead = dragSlot(2, 100, heights, 2);
assert.ok(overHead.over !== null && 'part' in rows[overHead.over]);
assert.equal(slotPart(rows, 2, overHead.slot), 1);
// Past three quarters of the heading, the heading slides up and the gap is in part 2.
const past = dragSlot(2, 160, heights, overHead.slot);
assert.equal(past.over, null);
assert.equal(slotPart(rows, 2, past.slot), 2);
// Held over the cream's middle, it's over a line: that combines, as in one part.
assert.equal(dragSlot(2, 180, heights, 2).over, 4);

// The lines in part order, each part's in the order they were.
assert.deepEqual(byPart(parts, ['cream', 'whiskey', 'coffee'].map(line)).map((l) => l.key), ['whiskey', 'coffee', 'cream']);
assert.deepEqual(byPart(null, ['cream', 'whiskey'].map(line)).map((l) => l.key), ['cream', 'whiskey'], 'one part keeps its order');

// Moving a part: the first never joins, and one that was first floats once it's later.
const swapped = movePart(parts, 1, -1);
assert.deepEqual(swapped.map((p) => [p.name, p.join]), [['The cream', null], ['The coffee', 'float']]);
assert.deepEqual(movePart(parts, 0, -1), parts, 'nothing above the first');

// Removing a part: its lines go to the part before, its methods with it.
const three = [...parts, { name: 'Nutmeg', join: 'float' as const, lines: ['nutmeg'], methods: [pick('Grate')] }];
assert.deepEqual(removePart(three, 2).map((p) => p.lines), [['whiskey', 'coffee', 'syrup'], ['cream', 'nutmeg']]);
// The first part's go to the next, which is first now and doesn't join.
const noFirst = removePart(three, 0);
assert.deepEqual(noFirst.map((p) => p.lines), [['whiskey', 'coffee', 'syrup', 'cream'], ['nutmeg']]);
assert.equal(noFirst[0].join, null);
// Two parts less one is one part: the editor turns parts off with what's left.
assert.equal(removePart(parts, 1).length, 1);

// The method button's words.
assert.equal(partMethodsSaid(['Build']), 'Build in the glass');
assert.equal(partMethodsSaid(['Whip (whisk or frother)']), 'Whip with a whisk or frother');
assert.equal(partMethodsSaid(['Shake', 'Strain']), 'Shake, then strain');
assert.equal(partMethodsSaid([]), '');
