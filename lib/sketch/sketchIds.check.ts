import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { askableIds } from './sketchIds';

const a = '0b53eb12-97fc-4f2f-8e0b-11fc41af7269';
const b = '00000000-0000-4000-d000-000000000001';
assert.deepEqual(askableIds([a, 'beer-ipa', b, 'wine-12', '']), [a, b]);
assert.deepEqual(askableIds(['beer-x']), []);
// A failed read must reject (not cache null): the query cache is saved between launches.
const hook = readFileSync('hooks/useItemSketch.ts', 'utf8');
assert.match(hook, /if \(error\) throw error;/);
assert.doesNotMatch(hook, /resolve\(new Map\(\)\)/);

console.log('sketchIds: ok');
