// The review-sign-in function: App Review's fixed code signs in its one
// account and nothing else. Runs against the local stack, where the review
// email and code are the LOCAL_REVIEW_* values in _shared/localStack.ts.
//
//   supabase start && supabase db reset
//   npm run test:security
//
// Skipped when the function isn't being served. REVIEW_SIGN_IN_URL points it
// at a function served some other way (e.g. `deno run` beside the stack).

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run review-sign-in tests against a non-local API: ${status.API_URL}`);
}

const FUNCTION_URL = process.env.REVIEW_SIGN_IN_URL ?? `${status.API_URL}/functions/v1/review-sign-in`;
// Same values as LOCAL_REVIEW_EMAIL / LOCAL_REVIEW_CODE.
const REVIEW_EMAIL = 'app-review@example.test';
const REVIEW_CODE = '424242';
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);

/** Served answers a GET with 405 (POST only); not served is a gateway 404 or no answer. */
async function probe(attempts) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(FUNCTION_URL, { headers: { apikey: status.ANON_KEY } });
      await res.body?.cancel();
      if (res.status === 405) return true;
    } catch {
      // not up yet
    }
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return false;
}
const served = await probe(process.env.CI ? 20 : 1);
if (!served && process.env.CI) {
  throw new Error('review-sign-in is not being served; CI starts the stack with edge-runtime for these tests.');
}
const skip = served ? false : 'review-sign-in is not served (start the stack with edge-runtime)';

function signIn(email, code) {
  return fetch(FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: status.ANON_KEY },
    body: JSON.stringify({ email, code }),
  });
}

async function reviewUser() {
  for (let page = 1; ; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => u.email === REVIEW_EMAIL);
    if (found || data.users.length < 1000) return found ?? null;
  }
}

async function removeReviewUser() {
  const user = await reviewUser();
  if (user) await service.auth.admin.deleteUser(user.id);
}

describe('review-sign-in function', { skip }, () => {
  before(removeReviewUser);
  after(removeReviewUser);

  test('any other email gets the wrong-code answer, and no account is made', async () => {
    const res = await signIn('someone-else@example.test', REVIEW_CODE);
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: "That code doesn't match." });
    assert.equal(await reviewUser(), null);
  });

  test('a wrong code is refused with the same answer', async () => {
    const res = await signIn(REVIEW_EMAIL, '000000');
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: "That code doesn't match." });
  });

  test('the right code gives a token that signs in as the review account, new accounts still run setup', async () => {
    await removeReviewUser();
    const res = await signIn(` ${REVIEW_EMAIL.toUpperCase()} `, REVIEW_CODE);
    assert.equal(res.status, 200);
    const { token_hash } = await res.json();
    assert.ok(token_hash);

    const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
    const { data, error } = await client.auth.verifyOtp({ token_hash, type: 'email' });
    assert.ifError(error);
    assert.equal(data.user.email, REVIEW_EMAIL);
    assert.ok(data.session.access_token);
    assert.equal(data.user.user_metadata.onboarded, false);

    // One use only.
    const again = await client.auth.verifyOtp({ token_hash, type: 'email' });
    assert.ok(again.error);
  });

  test("an existing account's own details are left alone", async () => {
    await removeReviewUser();
    const { error } = await service.auth.admin.createUser({
      email: REVIEW_EMAIL,
      email_confirm: true,
      user_metadata: { first_name: 'Review' },
    });
    assert.ifError(error);
    const res = await signIn(REVIEW_EMAIL, REVIEW_CODE);
    assert.equal(res.status, 200);
    const { token_hash } = await res.json();
    const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
    const signedIn = await client.auth.verifyOtp({ token_hash, type: 'email' });
    assert.ifError(signedIn.error);
    assert.ok(signedIn.data.session.access_token);
    const user = await reviewUser();
    assert.equal(user.user_metadata.first_name, 'Review');
    assert.equal(user.user_metadata.onboarded, undefined);
  });

  test('five wrong codes lock the account, even against the right one', async () => {
    await removeReviewUser();
    for (let i = 0; i < 5; i++) {
      const res = await signIn(REVIEW_EMAIL, `11111${i}`);
      assert.equal(res.status, 401);
      await res.body?.cancel();
    }
    const locked = await signIn(REVIEW_EMAIL, REVIEW_CODE);
    assert.equal(locked.status, 429);
    await locked.body?.cancel();
  });

  test('the right code clears earlier wrong tries', async () => {
    await removeReviewUser();
    for (let i = 0; i < 2; i++) {
      const res = await signIn(REVIEW_EMAIL, '999999');
      await res.body?.cancel();
    }
    const res = await signIn(REVIEW_EMAIL, REVIEW_CODE);
    assert.equal(res.status, 200);
    await res.body?.cancel();
    const user = await reviewUser();
    assert.equal(user.app_metadata.review_code_fails, 0);
  });
});
