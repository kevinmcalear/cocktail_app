// Discover's 30-second job and a save that deletes drinks must not deadlock
// (supabase/migrations/20261118300000_discover_job_no_deadlock.sql). Replays
// the CI failure of 25 Oct 2026: a transaction deletes one marked drink, the
// job runs, then the transaction deletes a second marked drink.
// Local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { after, before, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run discover job tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const save = new pg.Client({ connectionString: status.DB_URL });
const job = new pg.Client({ connectionString: status.DB_URL });
const ids = {};

async function serviceInsert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

before(async () => {
  await Promise.all([save.connect(), job.connect()]);
  ids.profile = (await serviceInsert('profiles', { kind: 'bar', is_public: true, handle: `djdead${run}`, display_name: `Deadlock Bar ${run}` })).id;
  const drink = async (name) => (await serviceInsert('items', { name: `${name} ${run}`, item_type: 'cocktail', origin_bar_profile_id: ids.profile })).id;
  ids.first = await drink('First Sour');
  ids.second = await drink('Second Sour');
  await job.query('SELECT private.run_discover_dirty(100000)');
  // Both drinks have facts and are marked again, as after an edit.
  await job.query('SELECT private.discover_mark($1)', [[ids.first, ids.second]]);
});

after(async () => {
  await save.query('ROLLBACK').catch(() => {});
  await save.query('DELETE FROM public.items WHERE name LIKE $1', [`%${run}`]);
  await save.query('DELETE FROM private.discover_dirty WHERE item_id = ANY($1)', [[ids.first, ids.second]]);
  await save.query('DELETE FROM public.profiles WHERE id = $1', [ids.profile]);
  await Promise.all([save.end(), job.end()]);
});

test('the job and a save deleting two marked drinks both finish', async () => {
  await save.query('BEGIN');
  await save.query('DELETE FROM public.items WHERE id = $1', [ids.first]);
  const jobRun = job.query('SELECT private.run_discover_dirty(100000)');
  // Let the job reach the first drink while the save still holds it.
  await sleep(300);
  const secondDelete = save.query('DELETE FROM public.items WHERE id = $1', [ids.second]).then(() => save.query('COMMIT'));
  const [jobResult, saveResult] = await Promise.allSettled([jobRun, secondDelete]);
  assert.equal(jobResult.status, 'fulfilled', `the job failed: ${jobResult.reason?.message}`);
  assert.equal(saveResult.status, 'fulfilled', `the save failed: ${saveResult.reason?.message}`);

  // The job skipped the drink being deleted; the next run drops both drinks' facts.
  await job.query('SELECT private.run_discover_dirty(100000)');
  const { rows } = await job.query('SELECT item_id FROM public.discover_drink_facts WHERE item_id = ANY($1)', [[ids.first, ids.second]]);
  assert.deepEqual(rows, []);
});
