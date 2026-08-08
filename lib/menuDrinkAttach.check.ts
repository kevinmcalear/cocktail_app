import assert from 'node:assert/strict';
import { withDrinkInSection } from './menuDrinkAttach';

const base = { a: ['x'], b: [] as string[] };

assert.deepEqual(withDrinkInSection(base, 'a', 'y').a, ['x', 'y']);
assert.deepEqual(withDrinkInSection(base, 'a', 'x').a, ['x']);
assert.deepEqual(withDrinkInSection(base, 'c', 'z').c, ['z']);
assert.deepEqual(withDrinkInSection({ a: ['draft', 'x'] }, 'a', 'pub', 'draft').a, ['x', 'pub']);
// original untouched
assert.deepEqual(base.a, ['x']);

console.log('menuDrinkAttach.check: ok');
