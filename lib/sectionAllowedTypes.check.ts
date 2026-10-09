import assert from 'node:assert/strict';
import { normalizeAllowedTypes } from './sectionAllowedTypes';

assert.deepEqual(normalizeAllowedTypes(['wine', 'cocktail', 'spirits']), ['cocktail', 'wine']);
assert.deepEqual(normalizeAllowedTypes([]), ['cocktail', 'beer', 'wine']);
assert.deepEqual(normalizeAllowedTypes(null), ['cocktail', 'beer', 'wine']);

console.log('sectionAllowedTypes.check.ts: ok');
