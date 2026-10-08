// A bar's page setting holds when a signed-in user reads items directly
// (supabase/migrations/20261010100000_bar_page_direct_reads.sql): a Locked
// page's credited drinks are its team's and catalog admins' only (everyone
// else gets the card from published_items), and the serve, dilution and price
// figures of a drink credited to a bar follow its spec rows.
// Runs against the local stack only: `npm run test:security`.
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
  throw new Error(`Refusing to run page read tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};
const FIGURES = 'serve_ml, serve_abv, dilution_pct, price, price_minor';

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  await db.query("INSERT INTO private.age_checks (user_id, country_code, minimum_age, confirmed_at) VALUES ($1, 'AU', 18, now())", [data.user.id]);
  return { id: data.user.id, client };
}

async function serviceInsert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

const setPage = (page) => db.query('UPDATE public.bars SET page_visibility = $2 WHERE id = $1', [ids.bar, page]);

const fromItems = async (client) => {
  const { data, error } = await client.from('items').select(`name, description, creator_profile_id, ${FIGURES}`).eq('id', ids.drink);
  assert.ifError(error);
  return data[0] ?? null;
};

const presented = async (client) => {
  const { data, error } = await client.from('app_item_presentation').select(`name, ${FIGURES}`).eq('id', ids.drink);
  assert.ifError(error);
  return data[0] ?? null;
};

const pictures = async (client) => {
  const { data, error } = await client.from('item_images').select('image_id').eq('item_id', ids.drink);
  assert.ifError(error);
  return data;
};

const topPicture = async (client) => {
  const { data, error } = await client.rpc('get_bar_top_drinks', { p_profile_id: ids.profile });
  assert.ifError(error);
  const row = data.find((r) => r.item_id === ids.drink);
  assert.ok(row, 'the drink is on the bar page');
  return row.image_url;
};

before(async () => {
  await db.connect();
  for (const label of ['stranger', 'team', 'catalogAdmin']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.catalogAdmin.id]);

  ids.bar = (await serviceInsert('bars', { name: `Quiet Room ${run}` })).id;
  ids.profile = (await serviceInsert('profiles', { kind: 'bar', handle: `quiet${run}`, display_name: `Quiet Room ${run}`, bar_id: ids.bar, is_public: true })).id;
  ids.person = (await serviceInsert('profiles', { kind: 'person', handle: `ada${run}`, display_name: `Ada ${run}`, is_public: true })).id;
  await serviceInsert('user_bars', { user_id: users.team.id, bar_id: ids.bar, role_level: 10 });

  // Seeded the way the 50 Best signatures are: shared, credited to the bar,
  // with the figures a spec gives it.
  ids.drink = (await serviceInsert('items', {
    item_type: 'cocktail',
    name: `Hush ${run}`,
    description: 'Clear, cold and quiet.',
    origin_bar_profile_id: ids.profile,
    creator_profile_id: ids.person,
    serve_ml: 95,
    serve_abv: 21.4,
    dilution_pct: 22,
    price: '$18',
    price_minor: 1800,
  })).id;
  const image = await serviceInsert('images', { url: `${status.API_URL}/storage/v1/object/public/drinks/cocktails/hush-${run}.jpg` });
  await serviceInsert('item_images', { item_id: ids.drink, image_id: image.id, angle: 'hero', sort_order: 0 });
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.images WHERE url LIKE $1', [like]);
  await db.query('DELETE FROM public.profiles WHERE handle LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM private.app_admins WHERE user_id = $1', [users.catalogAdmin?.id]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('a credited drink\'s figures', () => {
  test('are never on the row', async () => {
    const { rows } = await db.query(`SELECT ${FIGURES} FROM public.items WHERE id = $1`, [ids.drink]);
    assert.deepEqual(rows[0], { serve_ml: null, serve_abv: null, dilution_pct: null, price: null, price_minor: null });
  });

  test('stay with the bar while its page shows names and descriptions', async () => {
    await setPage('description');
    const direct = await fromItems(users.stranger.client);
    assert.equal(direct.description, 'Clear, cold and quiet.', 'the description still shows');
    assert.equal(direct.creator_profile_id, ids.person, 'so does the maker');
    assert.equal(direct.serve_ml, null);
    const viaView = await presented(users.stranger.client);
    assert.deepEqual([viaView.serve_ml, viaView.serve_abv, viaView.dilution_pct, viaView.price, viaView.price_minor], [null, null, null, null, null]);
    const { data, error } = await users.stranger.client.from('credited_drink_details').select('item_id').eq('item_id', ids.drink);
    assert.ifError(error);
    assert.equal(data.length, 0);
  });

  test('show to the bar\'s team and catalog admins', async () => {
    await setPage('description');
    for (const who of ['team', 'catalogAdmin']) {
      const row = await presented(users[who].client);
      assert.deepEqual(
        [Number(row.serve_ml), Number(row.serve_abv), Number(row.dilution_pct), row.price, row.price_minor],
        [95, 21.4, 22, '$18', 1800],
        who
      );
    }
  });

  test('show to everyone once the page is open', async () => {
    await setPage('open');
    const row = await presented(users.stranger.client);
    assert.equal(Number(row.serve_ml), 95);
    assert.equal(row.price_minor, 1800);
  });

  test('an update that names a figure sets it, NULL clears it, and others are kept', async () => {
    await db.query('UPDATE public.items SET price_minor = 2000, price = NULL WHERE id = $1', [ids.drink]);
    const { rows } = await db.query('SELECT serve_ml, price, price_minor FROM public.credited_drink_details WHERE item_id = $1', [ids.drink]);
    assert.deepEqual([Number(rows[0].serve_ml), rows[0].price, rows[0].price_minor], [95, null, 2000]);
    const row = await db.query('SELECT price, price_minor FROM public.items WHERE id = $1', [ids.drink]);
    assert.deepEqual(row.rows[0], { price: null, price_minor: null });
  });

  test('are worked out from the spec, and again when the dilution changes', async () => {
    const { rows: [gin] } = await db.query(
      "INSERT INTO public.items (item_type, name, abv) VALUES ('ingredient', $1, 40) RETURNING id",
      [`Gin ${run}`]
    );
    const { rows: [drink] } = await db.query(
      "INSERT INTO public.items (item_type, name, origin_bar_profile_id, dilution_pct) VALUES ('cocktail', $1, $2, 0) RETURNING id",
      [`Neat ${run}`, ids.profile]
    );
    await db.query("INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, amount, unit, sort_order) VALUES ($1, $2, 60, 'ml', 0)", [drink.id, gin.id]);
    const serve = async () => {
      const { rows } = await db.query('SELECT d.serve_ml, i.serve_ml AS on_row FROM public.credited_drink_details d JOIN public.items i ON i.id = d.item_id WHERE d.item_id = $1', [drink.id]);
      return [Number(rows[0].serve_ml), rows[0].on_row];
    };
    assert.deepEqual(await serve(), [60, null], 'no water: 60 ml');
    await db.query('UPDATE public.items SET dilution_pct = 50 WHERE id = $1', [drink.id]);
    assert.deepEqual(await serve(), [90, null], 'half as much again in water');
  });

  test('come back to the row when the drink stops being credited', async () => {
    const { rows: [made] } = await db.query(
      "INSERT INTO public.items (item_type, name, origin_bar_profile_id, serve_ml) VALUES ('cocktail', $1, $2, 120) RETURNING id",
      [`Moved ${run}`, ids.profile]
    );
    await db.query('UPDATE public.items SET origin_bar_profile_id = NULL WHERE id = $1', [made.id]);
    const { rows } = await db.query('SELECT serve_ml FROM public.items WHERE id = $1', [made.id]);
    assert.equal(Number(rows[0].serve_ml), 120);
    const left = await db.query('SELECT 1 FROM public.credited_drink_details WHERE item_id = $1', [made.id]);
    assert.equal(left.rowCount, 0);
    // And move again when it's credited once more.
    await db.query('UPDATE public.items SET origin_bar_profile_id = $2 WHERE id = $1', [made.id, ids.profile]);
    const again = await db.query('SELECT i.serve_ml AS on_row, d.serve_ml AS kept FROM public.items i JOIN public.credited_drink_details d ON d.item_id = i.id WHERE i.id = $1', [made.id]);
    assert.deepEqual([again.rows[0].on_row, Number(again.rows[0].kept)], [null, 120]);
  });
});

describe('a Locked page', () => {
  test('hides the credited drink\'s row, pictures and top-drink picture from people outside the bar', async () => {
    await setPage('locked');
    assert.equal(await fromItems(users.stranger.client), null, 'no row in items');
    assert.equal(await presented(users.stranger.client), null, 'nor in app_item_presentation');
    assert.equal((await pictures(users.stranger.client)).length, 0, 'no pictures');
    assert.equal(await topPicture(users.stranger.client), null, 'no picture on the bar page');
  });

  test('still gives them the name through published_items, without description or maker', async () => {
    await setPage('locked');
    const { data, error } = await users.stranger.client
      .from('published_items')
      .select('name, description, creator_profile_id, image_url')
      .eq('id', ids.drink)
      .eq('is_reference', false);
    assert.ifError(error);
    assert.deepEqual(data[0], { name: `Hush ${run}`, description: null, creator_profile_id: null, image_url: null });
  });

  test('keeps everything for the bar\'s team and catalog admins', async () => {
    await setPage('locked');
    for (const who of ['team', 'catalogAdmin']) {
      const row = await fromItems(users[who].client);
      assert.equal(row?.description, 'Clear, cold and quiet.', who);
      assert.equal(Number((await presented(users[who].client)).serve_ml), 95, who);
      assert.equal((await pictures(users[who].client)).length, 1, who);
      assert.ok(await topPicture(users[who].client), who);
    }
  });

  test('a page that shows descriptions keeps the row and pictures', async () => {
    await setPage('description');
    assert.ok(await fromItems(users.stranger.client));
    assert.equal((await pictures(users.stranger.client)).length, 1);
    assert.ok(await topPicture(users.stranger.client));
  });
});
