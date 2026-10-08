// Where a drink came from (20261008120000_drink_history.sql): anyone reads
// the books and their recipes, only app admins write them, wording is only
// kept from public-domain books, printed recipes tie to catalog drinks, and
// the books count in the pairing graph as their own era.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run drink history tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const ids = {};
let member;

before(async () => {
  await db.connect();
  const { data, error } = await service.auth.admin.createUser({ email: `reader-${run}@security-test.local`, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  member = { id: data.user.id, client: createClient(status.API_URL, status.ANON_KEY, clientOptions) };
  await member.client.auth.signInWithPassword({ email: `reader-${run}@security-test.local`, password: PASSWORD });
  const pd = await db.query(`INSERT INTO public.sources (key, kind, title, year, rights) VALUES ($1, 'book', 'Old Book', 1900, 'public_domain') RETURNING id`, [`old-${run}`]);
  const fo = await db.query(`INSERT INTO public.sources (key, kind, title, year, rights) VALUES ($1, 'book', 'Newer Book', 1950, 'facts_only') RETURNING id`, [`new-${run}`]);
  ids.pd = pd.rows[0].id;
  ids.fo = fo.rows[0].id;
  await db.query("SET app.image_worker = 'on'");
  const drink = await db.query(`INSERT INTO public.items (name, item_type, is_catalog) VALUES ($1, 'cocktail', true) RETURNING id`, [`History Sour ${run}`]);
  ids.drink = drink.rows[0].id;
  const bar = await db.query(`INSERT INTO public.items (name, item_type) VALUES ($1, 'cocktail') RETURNING id`, [`Not Catalog ${run}`]);
  ids.notCatalog = bar.rows[0].id;
});

after(async () => {
  await db.query('DELETE FROM public.sources WHERE id = ANY($1::uuid[])', [[ids.pd, ids.fo]]);
  await db.query('DELETE FROM public.items WHERE id = ANY($1::uuid[])', [[ids.drink, ids.notCatalog]]);
  await service.auth.admin.deleteUser(member.id);
  await db.end();
});

describe('drink history', () => {
  test('a quote needs a public-domain source', async () => {
    await assert.rejects(
      db.query(`INSERT INTO public.source_recipes (source_id, item_id, relation, quote) VALUES ($1, $2, 'version', 'word for word')`, [ids.fo, ids.drink]),
      /Only quote books in the public domain/
    );
    const ok = await db.query(`INSERT INTO public.source_recipes (source_id, item_id, relation, quote) VALUES ($1, $2, 'first_print', 'word for word') RETURNING id`, [
      ids.pd,
      ids.drink,
    ]);
    ids.recipe = ok.rows[0].id;
    await assert.rejects(db.query(`UPDATE public.sources SET rights = 'facts_only' WHERE id = $1`, [ids.pd]), /Remove the quotes/);
  });

  test('printed recipes tie to catalog drinks only', async () => {
    await assert.rejects(
      db.query(`INSERT INTO public.source_recipes (source_id, item_id, relation) VALUES ($1, $2, 'version')`, [ids.fo, ids.notCatalog]),
      /catalog drink/
    );
  });

  test('anyone reads, nobody but app admins writes', async () => {
    const { data, error } = await anon.from('source_recipes').select('id, quote, source:sources(key)').eq('item_id', ids.drink);
    assert.equal(error, null);
    assert.equal(data.length, 1);
    assert.equal(data[0].source.key, `old-${run}`);
    const write = await member.client.from('sources').insert({ key: `x-${run}`, kind: 'book', title: 'Mine', rights: 'public_domain' });
    assert.ok(write.error, 'a signed-in reader cannot add a source');
    const edit = await member.client.from('source_recipes').update({ quote: 'changed' }).eq('id', ids.recipe).select('id');
    assert.equal(edit.data?.length ?? 0, 0, 'nor change a recipe');
  });

  test('the books are their own era in the pairing graph', async () => {
    await db.query('SELECT private.refresh_ingredient_pairs()');
    const { rows } = await db.query(`SELECT count(*)::int AS n FROM public.ingredient_pairs WHERE era = 'books'`);
    // The migration's first printings give the old back bar's pairs.
    assert.ok(rows[0].n > 0, 'the books have pairs of their own');
    const { error } = await anon.rpc('get_pairings', { p_ids: [ids.drink], p_era: 'books', p_limit: 5 });
    assert.equal(error, null);
  });
});
