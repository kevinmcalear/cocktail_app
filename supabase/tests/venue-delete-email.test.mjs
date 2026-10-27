// When a venue's other Admins were emailed about its delete: only the
// venue-delete-email function (service role) writes it; members only read
// (supabase/migrations/20261125110000_venue_delete_email.sql).
// Runs against the local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run venue delete email tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
let admin;
let barId;

before(async () => {
  await db.connect();
  const email = `admin-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  admin = { id: data.user.id, client };
  const { rows } = await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`Little Rye ${run}`]);
  barId = rows[0].id;
  await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES ($1, $2, 40)', [barId, admin.id]);
});

after(async () => {
  await db.query('DELETE FROM public.bars WHERE id = $1', [barId]);
  await service.auth.admin.deleteUser(admin.id);
  await db.end();
});

test('an Admin reads emailed_at but cannot set it; the service role can, once', async () => {
  const { error } = await admin.client.rpc('delete_venue', { p_bar_id: barId, p_confirm_name: `Little Rye ${run}` });
  assert.ifError(error);
  const { data: request } = await admin.client.from('venue_delete_requests').select('emailed_at').eq('bar_id', barId).single();
  assert.equal(request.emailed_at, null);

  const { error: write } = await admin.client.from('venue_delete_requests').update({ emailed_at: new Date().toISOString() }).eq('bar_id', barId);
  assert.ok(write, 'members cannot mark the email sent');

  // The function's claim: the first update takes it, the second finds nothing.
  const claim = () => service.from('venue_delete_requests').update({ emailed_at: new Date().toISOString() }).eq('bar_id', barId).is('emailed_at', null).select('bar_id');
  assert.equal((await claim()).data.length, 1);
  assert.equal((await claim()).data.length, 0);
});
