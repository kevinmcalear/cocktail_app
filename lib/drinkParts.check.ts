import assert from 'node:assert/strict';

import { addPart, linePart, MAX_PARTS, partSentence, partsMethods, readParts, startParts, storedParts, toggleLine } from './drinkParts';

const pick = (name: string) => ({ id: null, name });
const line = (key: string) => ({ key, id: null, name: key, amount: '', unit: 'ml' });

// Turning it on: the drink so far is part 1, part 2 floats on it.
const parts = startParts({ lines: [line('whiskey'), line('coffee'), line('cream')], methods: [pick('Build')] });
assert.deepEqual(parts.map((p) => p.lines), [['whiskey', 'coffee', 'cream'], []]);
assert.equal(parts[1].join, 'float');

// A line tapped in part 2 moves there; tapped again it leaves.
const moved = toggleLine(parts, 1, 'cream');
assert.deepEqual(moved.map((p) => p.lines), [['whiskey', 'coffee'], ['cream']]);
assert.deepEqual(toggleLine(moved, 1, 'cream').map((p) => p.lines), [['whiskey', 'coffee'], []]);

// One list of methods for everything else: in order, each once.
const withMethods = [{ ...moved[0], methods: [pick('Build')] }, { ...moved[1], methods: [pick('Build'), pick('Whip (whisk or frother)')] }];
assert.deepEqual(partsMethods(withMethods).map((m) => m.name), ['Build', 'Whip (whisk or frother)']);

// Lines in no part: an ingredient goes in the first, a garnish in the last.
assert.equal(linePart(withMethods, 'cream', false), 2);
assert.equal(linePart(withMethods, 'nutmeg', true), 2);
assert.equal(linePart(withMethods, 'sugar', false), 1);
assert.equal(linePart(null, 'cream', false), 1, 'one part');

// Saved: blank names get a number, the first part never joins.
assert.deepEqual(storedParts([{ ...withMethods[0], name: ' The coffee ', join: 'pour' }, withMethods[1]]), [{ name: 'The coffee' }, { name: 'Part 2', join: 'float' }]);
assert.equal(readParts(null), null);
assert.equal(readParts([{ name: 'One' }]), null, 'one part is no parts');
assert.deepEqual(readParts([{ name: 'A' }, { name: 'B', join: 'pour' }]), [{ name: 'A' }, { name: 'B', join: 'pour' }]);

// Capped.
let many = parts;
for (let i = 0; i < 20; i++) many = addPart(many);
assert.equal(many.length, MAX_PARTS);

// The drink page's sentences (canvas Q20b, frame 4).
assert.equal(partSentence(['Build'], ['Irish whiskey', 'Hot coffee'], null), 'Build in the glass: Irish whiskey, Hot coffee.');
assert.equal(partSentence(['Whip (whisk or frother)'], ['Cream'], 'float'), 'Whip with a whisk or frother: Cream, then float it on top.');
assert.equal(partSentence(['Shake', 'Build'], [], 'pour'), 'Shake, then build in the glass, then pour it in.');
assert.equal(partSentence([], ['Cream'], null), 'Add: Cream.');

console.log('drink parts: ok');
