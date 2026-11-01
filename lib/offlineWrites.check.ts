// Checks for lib/offlineWrites.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { isNetworkError, retryBarWrite, specFingerprint } from './offlineWrites';

// --- what counts as no signal ---
assert.ok(isNetworkError(new TypeError('Network request failed')), 'React Native fetch');
assert.ok(isNetworkError(new TypeError('Failed to fetch')), 'Chrome');
assert.ok(isNetworkError(new TypeError('Load failed')), 'Safari');
assert.ok(isNetworkError({ message: 'TypeError: Network request failed', code: '' }), 'supabase-js wraps it with an empty code');
assert.ok(isNetworkError({ name: 'AbortError', message: 'The operation was aborted.' }));
assert.ok(!isNetworkError({ code: '42501', message: 'new row violates row-level security policy' }), 'a refusal is not');
assert.ok(!isNetworkError({ code: '23505', message: 'duplicate key value' }));
assert.ok(!isNetworkError(new Error('Name is required')));
assert.ok(!isNetworkError(null));

// --- bar writes try again only for signal, and not forever ---
assert.equal(retryBarWrite(0, new TypeError('Network request failed')), true);
assert.equal(retryBarWrite(4, new TypeError('Network request failed')), true);
assert.equal(retryBarWrite(5, new TypeError('Network request failed')), false);
assert.equal(retryBarWrite(0, { code: '42501', message: 'denied' }), false);

// --- the spec an edit started from ---
const spec = { name: 'Negroni', recipeItems: [{ ingredient_id: 'gin', amount: '30' }], parts: null };
assert.equal(specFingerprint(spec), specFingerprint({ parts: null, recipeItems: [{ amount: '30', ingredient_id: 'gin' }], name: 'Negroni' }), 'key order does not matter');
assert.notEqual(specFingerprint(spec), specFingerprint({ ...spec, recipeItems: [{ ingredient_id: 'gin', amount: '45' }] }), 'an amount does');
assert.notEqual(specFingerprint(spec), specFingerprint({ ...spec, recipeItems: [...spec.recipeItems, { ingredient_id: 'campari', amount: '30' }] }));

console.log('offlineWrites checks passed');
