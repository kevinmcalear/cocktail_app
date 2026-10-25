// Drafts in your account (20261113400000): the drink wizard's half-made
// drinks kept as `drafts` rows of entity_type 'drink_wizard', one per person
// and slot. Only their author reads a home draft; the slot is required for
// those rows and only those; upserting the same slot replaces it. Runs
// through the real API against the local stack.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run draft tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const users = {};

async function makeUser(label) {
  const email = `${label}-${run}@drafts-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

const row = (userId, slot, name) => ({ user_id: userId, entity_type: 'drink_wizard', slot, draft_data: { draft: { name }, step: 'ingredients', updatedAt: 1 } });

describe('drafts in your account', () => {
  before(async () => {
    users.maker = await makeUser('maker');
    users.other = await makeUser('other');
  });

  after(async () => {
    for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  });

  test('the author keeps one per slot: upserting the slot again replaces it', async () => {
    const { client, id } = users.maker;
    const first = await client.from('drafts').upsert(row(id, 'home|name:salty boy', 'Salty Boy'), { onConflict: 'user_id,entity_type,slot' });
    assert.equal(first.error, null);
    const again = await client.from('drafts').upsert(row(id, 'home|name:salty boy', 'Salty Boy, changed'), { onConflict: 'user_id,entity_type,slot' });
    assert.equal(again.error, null);
    const { data } = await client.from('drafts').select('slot, draft_data').eq('entity_type', 'drink_wizard');
    assert.equal(data.length, 1);
    assert.equal(data[0].draft_data.draft.name, 'Salty Boy, changed');
  });

  test('nobody else reads, changes or removes a home draft', async () => {
    const { client } = users.other;
    const { data } = await client.from('drafts').select('id').eq('user_id', users.maker.id);
    assert.deepEqual(data, []);
    const upd = await client.from('drafts').update({ draft_data: {} }).eq('user_id', users.maker.id).select();
    assert.deepEqual(upd.data, []);
    const del = await client.from('drafts').delete().eq('user_id', users.maker.id).select();
    assert.deepEqual(del.data, []);
    // Nor writes one as someone else.
    const forged = await client.from('drafts').insert(row(users.maker.id, 'home|name:forged', 'Forged'));
    assert.notEqual(forged.error, null);
  });

  test('a wizard draft needs its slot, and other drafts take none', async () => {
    const { client, id } = users.maker;
    const noSlot = await client.from('drafts').insert({ ...row(id, null, 'X'), slot: null });
    assert.notEqual(noSlot.error, null);
    const slotted = await client.from('drafts').insert({ user_id: id, entity_type: 'cocktail', slot: 'home', draft_data: {} });
    assert.notEqual(slotted.error, null);
  });
});
