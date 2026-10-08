// The read-anything function (Bring in's reader): who can call it, what it
// accepts, and the reading it returns. Runs against the local stack, where the
// model is always mocked (see _shared/gemini.ts mockAnythingReads).
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
  throw new Error(`Refusing to run read-anything tests against a non-local API: ${status.API_URL}`);
}

const FUNCTION_URL = `${status.API_URL}/functions/v1/read-anything`;
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
  throw new Error('read-anything is using the real model; unset READ_MODEL=live in supabase/functions/.env before running tests.');
}
if (!model && process.env.CI) {
  throw new Error('read-anything is not being served; CI starts the stack with edge-runtime for these tests.');
}
const skip = model === 'mock' ? false : 'read-anything is not served (start the stack with edge-runtime)';

after(async () => {
  for (const id of userIds) await service.auth.admin.deleteUser(id);
});

/** A throwaway local user's id and access token. */
async function signedIn() {
  const email = `read-anything-${run}-${userIds.length}@security-test.local`;
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
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM private.ai_usage WHERE user_id = $1 AND fn = 'read-anything'`, [userId]);
    return rows[0].n;
  } finally {
    await db.end();
  }
}

describe('read-anything function', { skip }, () => {
  test('refuses callers who are not signed in, even with the anon key', async () => {
    const res = await read(status.ANON_KEY, { text: '2 oz gin' });
    assert.equal(res.status, 401);
    await res.body?.cancel();
  });

  test('refuses requests with nothing usable to read, and charges nothing for them', async () => {
    const user = await signedIn();
    const cases = [
      [{}, 400],
      [{ files: [], text: '   ' }, 400],
      [{ files: [{ base64: '' }] }, 400],
      [{ files: [{ base64: PHOTO, mime_type: 'text/html' }] }, 400],
      [{ files: Array(5).fill({ base64: PHOTO, mime_type: 'image/webp' }) }, 400],
      [{ files: [{ base64: 'a'.repeat(11_000_001), mime_type: 'application/pdf' }] }, 413],
      [{ text: 'a'.repeat(20_001) }, 413],
    ];
    for (const [body, code] of cases) {
      const res = await read(user.token, body);
      assert.equal(res.status, code, JSON.stringify(body).slice(0, 80));
      assert.equal(typeof (await res.json()).error, 'string');
    }
    assert.equal(await usage(user.id), 0);
  });

  test('reads photos as recipes Bring in can check, for one AI unit', async () => {
    const user = await signedIn();
    const res = await read(user.token, { files: [{ base64: PHOTO, mime_type: 'image/webp' }, { base64: PHOTO, mime_type: 'application/pdf' }], hint: 'recipes' });
    assert.equal(res.status, 200);
    const reading = await res.json();
    assert.equal(reading.kind, 'recipes');
    assert.equal(reading.menu, null);
    assert.deepEqual(reading.recipes.map((r) => r.name), ['Negroni', 'Orchard Fizz']);
    assert.deepEqual(reading.recipes[1].lines[2], { amount: 0.75, unit: 'oz', ingredient: 'Lemon Juice', unsure: true });
    assert.equal(await usage(user.id), 1);
  });

  test('pasted text alone is enough, and the hint picks what the mock reads', async () => {
    const user = await signedIn();
    const menu = await read(user.token, { text: 'Spring menu\nNegroni 16', hint: 'menu' });
    assert.equal(menu.status, 200);
    const reading = await menu.json();
    assert.equal(reading.kind, 'menu');
    assert.equal(reading.menu.sections[0].lines[1].price, '16');
    const bottles = await (await read(user.token, { text: 'Campari', hint: 'bottles' })).json();
    assert.equal(bottles.kind, 'bottles');
    assert.equal(bottles.bottles[0].name, 'Beefeater London Dry Gin');
    assert.equal(await usage(user.id), 2);
  });
});
