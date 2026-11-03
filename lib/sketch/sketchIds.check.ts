import assert from 'node:assert/strict';

import { askableIds } from './sketchIds';

const a = '0b53eb12-97fc-4f2f-8e0b-11fc41af7269';
const b = '00000000-0000-4000-d000-000000000001';
assert.deepEqual(askableIds([a, 'beer-ipa', b, 'wine-12', '']), [a, b]);
assert.deepEqual(askableIds(['beer-x']), []);
console.log('sketchIds: ok');
