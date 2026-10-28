// Close names for "Did you mean" (supabase/migrations/20261109100000_near_names.sql).
// public.near_score must agree with lib/nearName.ts on every local drink and
// ingredient, and saved spellings (public.item_spellings, save_spelling)
// may only be close spellings of drinks the saver can see, show where the
// drink shows, and never say who saved them. Local stack only:
// `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { tsImport } from 'tsx/esm/api';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run near name tests against a non-local API: ${status.API_URL}`);
}

const { nearScore, personNearScore } = await tsImport('../../lib/nearName.ts', import.meta.url);

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

// Typos tried on the local drinks, plus words that test each rule.
const QUERIES = [
  'salty boy', 'negorni', 'ramos fiz', 'mai tie', 'peeny colada', 'kosmo', 'jungel bird', 'boulevardeir',
  'chartruse', 'old fashoned', 'espreso martini', 'gin', 'no', 'corpse reviver 2', 'pina', 'remi savage',
];

const ids = {};
let saver;

async function makeUser(label) {
  const email = `${label}-${run}@near-names-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

async function serviceInsert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

before(async () => {
  await db.connect();
  saver = await makeUser('saver');
  // A classic anyone can see (no bar, no creator, so it's published).
  ids.classic = (await serviceInsert('items', { name: `Salti Boi ${run}`, item_type: 'cocktail' })).id;
  // A bar's own drink the saver can't see.
  ids.bar = (await serviceInsert('bars', { name: `Near Bar ${run}` })).id;
  ids.private = (await serviceInsert('items', { name: `Hidden Fizz ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
});

after(async () => {
  await db.query('DELETE FROM public.items WHERE id = ANY($1)', [[ids.classic, ids.private].filter(Boolean)]);
  if (ids.bar) await db.query('DELETE FROM public.bars WHERE id = $1', [ids.bar]);
  if (saver) await service.auth.admin.deleteUser(saver.id);
  await db.end();
});

describe('near_score', () => {
  test('agrees with lib/nearName.ts on every local drink and ingredient', async () => {
    const { rows } = await db.query(
      `SELECT q, i.name, public.near_score(q, i.name) AS score
         FROM public.items i, unnest($1::text[]) q
        WHERE i.item_type IN ('cocktail', 'ingredient')`,
      [QUERIES]
    );
    assert.ok(rows.length > QUERIES.length * 100, `expected the local catalog, got ${rows.length} rows`);
    const differ = rows.filter((r) => nearScore(r.q, r.name) !== r.score);
    assert.deepEqual(
      differ.slice(0, 10).map((r) => ({ q: r.q, name: r.name, sql: r.score, app: nearScore(r.q, r.name) })),
      [],
      `${differ.length} of ${rows.length} pairs differ`
    );
  });

  test('person_near_score agrees with personNearScore: short first names and slips (20261128300000)', async () => {
    const pairs = [
      ['Matt Reisler', 'Mathew Resler'],
      ['Matt Resler', 'Mathew Resler'],
      ['Mark Resler', 'Mathew Resler'],
      ['Mat Resler', 'Mathew Resler'],
      ['matt', 'Mathew Resler'],
      ['  Samm   Ortiz ', 'Samantha Ortiz'],
      ['Jo Marsh', 'Joe Marsh'],
      ['José Ortiz', 'Jose Ortiz'],
    ];
    const { rows } = await db.query('SELECT public.person_near_score(q, n) AS score FROM unnest($1::text[], $2::text[]) AS p(q, n)', [
      pairs.map((p) => p[0]),
      pairs.map((p) => p[1]),
    ]);
    assert.deepEqual(rows.map((r) => r.score), pairs.map(([q, n]) => personNearScore(q, n)));
    assert.notEqual(rows[0].score, null, 'Matt Reisler finds Mathew Resler');
    assert.equal(rows[2].score, null, 'Mark Resler does not');
  });

  test('counts characters as the app does', async () => {
    const pairs = [['ab🍸cdef', 'ax🍸cdeg'], ['ab🍸cdef', 'ax🍸cdef'], ['  Piña   Colada ', 'pina colada'], ['jungel bird', 'Jungle Bird']];
    const { rows } = await db.query('SELECT public.near_score(q, n) AS score FROM unnest($1::text[], $2::text[]) AS p(q, n)', [
      pairs.map((p) => p[0]),
      pairs.map((p) => p[1]),
    ]);
    assert.deepEqual(rows.map((r) => r.score), pairs.map(([q, n]) => nearScore(q, n)));
  });

  test('anyone may call it, signed out too', async () => {
    const { data, error } = await anon.rpc('near_score', { p_query: 'negorni', p_name: 'Negroni' });
    assert.equal(error, null);
    assert.equal(data, 3);
  });
});

describe('saved spellings', () => {
  const spellingsOf = async (id) =>
    (await db.query('SELECT spelling, saved_by FROM public.item_spellings WHERE item_id = $1 ORDER BY spelling', [id])).rows;

  test('a close spelling of a drink you can see is kept, folded, once', async () => {
    for (const typed of ['  SALTY Boy ' + run, 'salty boy ' + run]) {
      const { data, error } = await saver.client.rpc('save_spelling', { p_item_id: ids.classic, p_typed: typed });
      assert.equal(error, null);
      assert.equal(data, true);
    }
    assert.deepEqual(await spellingsOf(ids.classic), [{ spelling: `salty boy ${run}`, saved_by: saver.id }]);
  });

  test('a far spelling, the name itself, or a drink you cannot see is not kept', async () => {
    for (const [id, typed] of [
      [ids.classic, `smoke signal ${run}`],
      [ids.classic, `Salti Boi ${run}`],
      [ids.classic, '   '],
      [ids.private, `hiden fizz ${run}`],
      [randomUUID(), 'salty boy'],
    ]) {
      const { data, error } = await saver.client.rpc('save_spelling', { p_item_id: id, p_typed: typed });
      assert.equal(error, null);
      assert.equal(data, false, typed);
    }
    assert.deepEqual(await spellingsOf(ids.private), []);
  });

  test('signed out cannot save', async () => {
    const { error } = await anon.rpc('save_spelling', { p_item_id: ids.classic, p_typed: `salty boi ${run}` });
    assert.ok(error, 'anon has no execute on save_spelling');
  });

  test('writing the table directly still needs a close spelling and your own name on it', async () => {
    const far = await saver.client.from('item_spellings').insert({ item_id: ids.classic, spelling: `negroni ${run}` });
    assert.ok(far.error, 'a far spelling is refused');
    const theirs = await saver.client.from('item_spellings').insert({ item_id: ids.classic, spelling: `salti boy ${run}`, saved_by: randomUUID() });
    assert.ok(theirs.error, 'saved_by cannot be set');
    const unfolded = await saver.client.from('item_spellings').insert({ item_id: ids.classic, spelling: `Salti Boy ${run}` });
    assert.ok(unfolded.error, 'only folded spellings');
  });

  test('200 a day at most', async () => {
    await db.query(
      `INSERT INTO public.item_spellings (item_id, spelling, saved_by)
       SELECT $1, 'cap ' || g || ' ${run}', $2 FROM generate_series(1, 199) g`,
      [ids.classic, saver.id]
    );
    try {
      const { data } = await saver.client.rpc('save_spelling', { p_item_id: ids.classic, p_typed: `salti boy ${run}` });
      assert.equal(data, false, 'the 201st is not kept');
      const direct = await saver.client.from('item_spellings').insert({ item_id: ids.classic, spelling: `salty boi ${run}` });
      assert.ok(direct.error, 'nor written directly');
    } finally {
      await db.query(`DELETE FROM public.item_spellings WHERE item_id = $1 AND spelling LIKE 'cap %'`, [ids.classic]);
    }
  });

  test('a published drink’s spellings show to anyone, without who saved them', async () => {
    const { rows } = await db.query('SELECT EXISTS (SELECT 1 FROM public.published_items WHERE id = $1) AS published', [ids.classic]);
    assert.equal(rows[0].published, true, 'fixture drink is published');
    const { data, error } = await anon.from('item_spellings').select('item_id, spelling').eq('item_id', ids.classic);
    assert.equal(error, null);
    assert.deepEqual(data, [{ item_id: ids.classic, spelling: `salty boy ${run}` }]);
    const who = await anon.from('item_spellings').select('saved_by').eq('item_id', ids.classic);
    assert.ok(who.error, 'saved_by is not readable');
  });

  test('a hidden drink’s spellings stay hidden', async () => {
    await db.query('INSERT INTO public.item_spellings (item_id, spelling) VALUES ($1, $2)', [ids.private, `hiden fizz ${run}`]);
    for (const client of [anon, saver.client]) {
      const { data, error } = await client.from('item_spellings').select('spelling').eq('item_id', ids.private);
      assert.equal(error, null);
      assert.deepEqual(data, []);
    }
  });

  test('spellings go with their drink', async () => {
    await db.query('DELETE FROM public.items WHERE id = $1', [ids.private]);
    assert.deepEqual(await spellingsOf(ids.private), []);
  });
});
