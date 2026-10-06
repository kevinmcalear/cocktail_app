// Signed-out visitors can read every column a profile page selects
// (supabase/migrations/20261006120000_profile_instagram_anon.sql,
// 20261006200000_profile_social_links.sql).
// anon reads profiles by column (20260927000000), so a new column the page
// selects needs its own grant, or /p/<handle> fails for everyone signed out.
// Runs against the local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run profile column tests against a non-local API: ${status.API_URL}`);
}

// Read the list from the hook itself, so a column added there is checked here.
const hook = readFileSync(new URL('../../hooks/useProfiles.ts', import.meta.url), 'utf8');
const COLUMNS = hook.match(/^const COLUMNS = '([^']+)';$/m)?.[1];

const run = randomUUID().slice(0, 8);
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
let profileId;

before(async () => {
  const { data, error } = await service
    .from('profiles')
    .insert({ kind: 'bar', handle: `cols${run}`, display_name: `Columns Bar ${run}`, instagram: `cols${run}`, social_links: [`https://www.tiktok.com/@cols${run}`], is_public: true })
    .select('id')
    .single();
  if (error) throw new Error(`fixture insert into profiles failed: ${error.message}`);
  profileId = data.id;
});

after(async () => {
  if (profileId) await service.from('profiles').delete().eq('id', profileId);
});

test("useProfile's column list is readable from the hook", () => {
  assert.ok(COLUMNS, 'could not find `const COLUMNS = ...` in hooks/useProfiles.ts');
});

test('a signed-out visitor can select every column useProfile selects', async () => {
  const { data, error } = await anon.from('profiles').select(COLUMNS).eq('handle', `cols${run}`).maybeSingle();
  assert.ifError(error);
  assert.equal(data?.id, profileId);
  assert.equal(data.instagram, `cols${run}`);
  assert.deepEqual(data.social_links, [`https://www.tiktok.com/@cols${run}`]);
});

test('each column on its own, so a failure names the missing grant', async () => {
  const denied = [];
  for (const column of COLUMNS.split(',').map((c) => c.trim())) {
    const { error } = await anon.from('profiles').select(column).eq('id', profileId);
    if (error) denied.push(`${column} (${error.code})`);
  }
  assert.deepEqual(denied, [], `anon can't select: ${denied.join(', ')}. Add GRANT SELECT ("<column>") ON "public"."profiles" TO "anon".`);
});

test('social_links takes only profile pages on the networks the app knows', async () => {
  const set = (social_links) => service.from('profiles').update({ social_links }).eq('id', profileId);
  for (const ok of [
    ['https://www.facebook.com/cols.bar/', 'https://x.com/cols_bar', 'https://www.youtube.com/@cols', 'https://www.threads.com/@cols.bar'],
    ['https://www.youtube.com/channel/UCabc-123_x', 'https://www.facebook.com/p/Cols-Bar-1000642/'],
    null,
  ]) {
    const { error } = await set(ok);
    assert.ifError(error);
  }
  for (const bad of [
    ['https://evil.example/cols'],
    ['javascript:alert(1)'],
    ['https://www.instagram.com/cols/'],
    ['https://x.com/cols https://evil.example'],
    ['https://x.com/a,https://x.com/b'],
    ['https://www.tiktok.com/@cols', null],
    [],
  ]) {
    const { error } = await set(bad);
    assert.equal(error?.code, '23514', `accepted ${JSON.stringify(bad)}`);
  }
});
