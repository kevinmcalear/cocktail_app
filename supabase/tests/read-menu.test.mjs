// The read-menu function: who can call it, what it accepts, and the reading it
// returns. Runs against the local stack, where the model is always mocked (see
// _shared/gemini.ts mockMenuReads).
//
//   supabase start && supabase db reset
//   npm run test:security
//
// Skipped when the function isn't being served, and refuses to run unless it
// reports the mocked model, so it never spends real AI quota.

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run read-menu tests against a non-local API: ${status.API_URL}`);
}

const FUNCTION_URL = `${status.API_URL}/functions/v1/read-menu`;
const PHOTO = readFileSync(new URL('./fixtures/green-drink.webp', import.meta.url)).toString('base64');
const run = randomUUID().slice(0, 8);
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const userIds = [];

async function probe(attempts) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(FUNCTION_URL, { headers: { apikey: status.ANON_KEY, Authorization: `Bearer ${status.ANON_KEY}` } });
      if (res.ok) return (await res.json()).model ?? null;
      await res.body?.cancel();
    } catch {
      // not up yet
    }
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return null;
}
const model = await probe(process.env.CI ? 20 : 1);
if (model === 'live') {
  throw new Error('read-menu is using the real model; unset MENU_MODEL=live in supabase/functions/.env before running tests.');
}
if (!model && process.env.CI) {
  throw new Error('read-menu is not being served; CI starts the stack with edge-runtime for these tests.');
}
const skip = model === 'mock' ? false : 'read-menu is not served (start the stack with edge-runtime)';

after(async () => {
  for (const id of userIds) await service.auth.admin.deleteUser(id);
});

/** A throwaway local user's id and access token. */
async function signedIn() {
  const email = `read-menu-${run}-${userIds.length}@security-test.local`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  userIds.push(data.user.id);
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { data: session, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return { id: data.user.id, token: session.session.access_token };
}

function read(token, body) {
  return fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: status.ANON_KEY, Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

async function usage(userId) {
  const db = new pg.Client({ connectionString: status.DB_URL });
  await db.connect();
  try {
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM private.ai_usage WHERE user_id = $1 AND fn = 'read-menu'`, [userId]);
    return rows[0].n;
  } finally {
    await db.end();
  }
}

describe('read-menu function', { skip }, () => {
  test('refuses callers who are not signed in, even with the anon key', async () => {
    const res = await read(status.ANON_KEY, { photos: [{ base64: PHOTO, mime_type: 'image/webp' }] });
    assert.equal(res.status, 401);
    await res.body?.cancel();
  });

  test('refuses requests without usable photos, and charges nothing for them', async () => {
    const user = await signedIn();
    const cases = [
      [{}, 400],
      [{ photos: [] }, 400],
      [{ photos: [{ base64: '' }] }, 400],
      [{ photos: [{ base64: PHOTO, mime_type: 'application/pdf' }] }, 400],
      [{ photos: Array(5).fill({ base64: PHOTO, mime_type: 'image/webp' }) }, 400],
      [{ photos: [{ base64: 'a'.repeat(11_000_001), mime_type: 'image/jpeg' }] }, 413],
    ];
    for (const [body, code] of cases) {
      const res = await read(user.token, body);
      assert.equal(res.status, code, JSON.stringify(body).slice(0, 80));
      assert.equal(typeof (await res.json()).error, 'string');
    }
    assert.equal(await usage(user.id), 0);
  });

  test('reads the pages into sections the paste matcher takes, for one AI unit', async () => {
    const user = await signedIn();
    const res = await read(user.token, { photos: [{ base64: PHOTO, mime_type: 'image/webp' }, { base64: PHOTO, mime_type: 'image/webp' }] });
    assert.equal(res.status, 200);
    const reading = await res.json();
    assert.equal(reading.title, 'Spring Menu');
    assert.deepEqual(reading.sections.map((s) => s.name), ['Signatures', 'Classics']);
    assert.deepEqual(reading.sections[0].lines[0], { name: 'House Martini', price: '19', ingredients: ['Gin', 'Dry vermouth', 'Lemon twist'] });
    assert.equal(reading.sections[0].lines[2].price, '18.00');
    assert.equal(await usage(user.id), 1);
  });
});
