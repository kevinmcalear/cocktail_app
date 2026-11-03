// The drink page's shared items flags (hooks/itemFlags.ts): undefined means
// "no recent copy, read it yourself"; null is a real answer (no readable row).
import assert from 'node:assert/strict';

import { QueryClient } from '@tanstack/react-query';

import { forgetItemFlags, keepItemFlags, recentItemFlags } from './itemFlags';

const client = new QueryClient();
assert.equal(recentItemFlags(client, 'a'), undefined, 'nothing kept yet');
keepItemFlags(client, 'a', null);
assert.equal(recentItemFlags(client, 'a'), null, 'an unreadable row is kept as null, not as missing');
const flags = { parts: null, spec_hidden: true, awaiting_approval: true, created_by: null, bar_id: 'b' };
keepItemFlags(client, 'a', flags);
assert.deepEqual(recentItemFlags(client, 'a'), flags);
forgetItemFlags(client, 'a');
assert.equal(recentItemFlags(client, 'a'), undefined, 'forgotten after a write');
keepItemFlags(client, 'a', flags);
const real = Date.now;
Date.now = () => real() + 31_000;
assert.equal(recentItemFlags(client, 'a'), undefined, 'an old copy is not trusted');
Date.now = real;
client.clear();
console.log('itemFlags: ok');
