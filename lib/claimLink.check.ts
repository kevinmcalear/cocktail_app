// Checks for lib/claimLink.ts. Run: npm run test:unit
import assert from 'node:assert/strict';

import { claimPath, claimRecord, readClaimReturn } from './claimLink';

const now = Date.UTC(2026, 9, 25, 12);
const hour = 60 * 60 * 1000;

assert.equal(claimPath('ash.okafor'), '/p/ash.okafor?claim=1');
assert.equal(claimPath('a/b'), '/p/a%2Fb?claim=1');

// Fresh for a day, then forgotten.
assert.equal(readClaimReturn(claimRecord('ash.okafor', now), now + hour), '/p/ash.okafor?claim=1');
assert.equal(readClaimReturn(claimRecord('ash.okafor', now), now + 25 * hour), null);
assert.equal(readClaimReturn(claimRecord('ash.okafor', now + hour), now), null);

// Nothing stored, junk, or a path that isn't a claim: no redirect.
assert.equal(readClaimReturn(null, now), null);
assert.equal(readClaimReturn('not json', now), null);
assert.equal(readClaimReturn(JSON.stringify({ path: 'https://evil.example/p/x?claim=1', at: now }), now), null);
assert.equal(readClaimReturn(JSON.stringify({ path: '/settings', at: now }), now), null);
assert.equal(readClaimReturn(JSON.stringify({ path: '/p/x?claim=1&next=/a', at: now }), now), null);
assert.equal(readClaimReturn(JSON.stringify({ path: '/p/x?claim=1' }), now), null);

console.log('claimLink checks passed');
