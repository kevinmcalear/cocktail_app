// Can the bar make it (supabase/migrations/20261121300000_venue_can_make.sql):
// only the venue's staff can ask; the back bar is its stock list, its spots,
// its own ingredients, what its own drinks pour and the pantry staples; and
// the matching follows my_bar_drinks rule for rule, checked here by putting
// the same shelf at home and asking both. Local stack only:
// `npm run test:security`.
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
  throw new Error(`Refusing to run venue can-make tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
// Every drink's name starts with this, so my_bar_drinks can page straight to them.
const PREFIX = `vcm-${run}`;
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const ids = {};
const users = {};

async function makeUser(label) {
  const email = `${label}-${run}@venue-can-make-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

/** A fixture row, written straight to the database. */
async function insert(table, row) {
  const cols = Object.keys(row);
  const sql = `INSERT INTO public.${table} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
  const { rows } = await db.query(sql, Object.values(row));
  return rows[0];
}

// Made-up words: an ingredient named like a catalog style ("amaro") is given
// that style on insert (private.shape_ingredient), which would change the tree.
const NAMES = {
  gin: 'grin', 'london-dry': 'lundry', 'old-tom-style': 'oldtum', tanqueray: 'tankra', beefeater: 'befita', 'plymouth-gin': 'plimo',
  campari: 'kampo', bitter: 'bittra', vermouth: 'vermo', almond: 'almo', falernum: 'falo', amaro: 'amra', 'citrus-peel': 'pelo',
  mezcal: 'mesko', lillet: 'lilo', syrup: 'siro', orgeat: 'orjo', cordial: 'kordo', 'cordial-base': 'kordbase',
};

const item = async (key, row) => {
  ids[key] = (await insert('items', { ...row, name: `${PREFIX} ${NAMES[key] ?? key}` })).id;
};

/** Lines as [ingredient key, more columns]; every line has an amount unless it says otherwise. */
async function recipe(key, lines) {
  for (const [i, [ingredient, more = {}]] of lines.entries()) {
    await insert('recipes', { recipe_item_id: ids[key], ingredient_item_id: ids[ingredient], amount: 30, unit: 'ml', sort_order: i, ...more });
  }
}

const DRINKS = ['martini', 'gin-syrup', 'plymouth', 'old-tom', 'negroni', 'orgeat-sour', 'far', 'mezcal-sour', 'own-cordial', 'no-spec', 'hidden'];

/** venue_can_make for this run's drinks, by key: { can, count, missing: [names] }. */
async function canMake(who, barKey = 'bar', keys = DRINKS) {
  const { data, error } = await users[who].client.rpc('venue_can_make', { p_bar_id: ids[barKey], p_drink_ids: keys.map((k) => ids[k]) });
  if (error) return { error };
  const key = Object.fromEntries(Object.entries(ids).map(([k, v]) => [v, k]));
  return Object.fromEntries(data.map((r) => [key[r.drink_id], { can: r.can_make, count: r.missing_count, missing: r.missing.map((m) => m.name.replace(`${PREFIX} `, '')) }]));
}

const staple = async (name) => {
  const { rows } = await db.query(
    "SELECT id FROM public.items WHERE item_type = 'ingredient' AND bar_id IS NULL AND public.ingredient_key(name) = public.ingredient_key($1) LIMIT 1",
    [name]
  );
  assert.ok(rows[0], `the catalog has ${name}`);
  return rows[0].id;
};

before(async () => {
  await db.connect();
  for (const label of ['guest', 'bartender', 'outsider', 'otherStaff']) users[label] = await makeUser(label);
  ids.bar = (await insert('bars', { name: `${PREFIX} bar` })).id;
  ids.otherBar = (await insert('bars', { name: `${PREFIX} other bar` })).id;
  await insert('user_bars', { user_id: users.guest.id, bar_id: ids.bar, role_level: 10 });
  await insert('user_bars', { user_id: users.bartender.id, bar_id: ids.bar, role_level: 30 });
  await insert('user_bars', { user_id: users.otherStaff.id, bar_id: ids.otherBar, role_level: 30 });
  ids.sugar = await staple('Sugar');
  ids.water = await staple('Water');

  // Styles: Gin > London Dry; Bitter liqueur; Vermouth; Almond.
  for (const k of ['gin', 'vermouth', 'bitter', 'almond', 'citrus-peel', 'falernum', 'amaro', 'cordial-base']) {
    await item(k, { item_type: 'ingredient', ingredient_role: 'generic' });
  }
  await item('london-dry', { item_type: 'ingredient', ingredient_role: 'generic', generic_id: ids.gin });
  await item('old-tom-style', { item_type: 'ingredient', ingredient_role: 'generic', generic_id: ids.gin });
  // Bottles: Tanqueray and Beefeater are London Dry; Plymouth is a Gin; Campari is a Bitter liqueur.
  for (const k of ['tanqueray', 'beefeater']) await item(k, { item_type: 'ingredient', ingredient_role: 'product', generic_id: ids['london-dry'] });
  await item('plymouth-gin', { item_type: 'ingredient', ingredient_role: 'product', generic_id: ids.gin });
  await item('campari', { item_type: 'ingredient', ingredient_role: 'product', generic_id: ids.bitter });
  await item('mezcal', { item_type: 'ingredient', ingredient_role: 'product' });
  await item('lillet', { item_type: 'ingredient', ingredient_role: 'product' });
  // House-made: a syrup of sugar and water (staples), an orgeat that needs almonds.
  await item('syrup', { item_type: 'ingredient', ingredient_role: 'prep' });
  await recipe('syrup', [['sugar'], ['water']]);
  await item('orgeat', { item_type: 'ingredient', ingredient_role: 'prep' });
  await recipe('orgeat', [['sugar'], ['almond']]);
  // The bar's own cordial, and one of its drinks that pours mezcal.
  await item('cordial', { item_type: 'ingredient', ingredient_role: 'prep', bar_id: ids.bar });
  await recipe('cordial', [['cordial-base']]);
  await item('house-drink', { item_type: 'cocktail', bar_id: ids.bar });
  await recipe('house-drink', [['mezcal']]);

  for (const k of DRINKS.filter((d) => d !== 'hidden')) await item(k, { item_type: 'cocktail' });
  // A sibling bottle stands in; a twist and an optional line never block.
  await recipe('martini', [['beefeater'], ['vermouth'], ['citrus-peel', { amount: 1, unit: 'twist' }], ['lillet', { is_optional: true }]]);
  // A plain line ("Gin") is covered by a bottle below it; house-made syrup from the staples.
  await recipe('gin-syrup', [['gin'], ['syrup']]);
  // A bottle of a sibling style isn't: Plymouth is a Gin, not a London Dry.
  await recipe('plymouth', [['plymouth-gin'], ['vermouth']]);
  await recipe('old-tom', [['old-tom-style'], ['vermouth']]);
  // Campari is on the map (a spot), so covered.
  await recipe('negroni', [['tanqueray'], ['campari'], ['vermouth']]);
  // A missing house-made ingredient stands for what its recipe is missing.
  await recipe('orgeat-sour', [['gin'], ['orgeat']]);
  await recipe('far', [['almond'], ['falernum'], ['amaro'], ['plymouth-gin']]);
  // Mezcal: poured by the bar's own drink. The cordial: the bar's own ingredient.
  await recipe('mezcal-sour', [['mezcal'], ['syrup']]);
  await recipe('own-cordial', [['cordial'], ['gin']]);
  await recipe('no-spec', [['gin', { amount: null }]]);

  // A drink only its bar may read: no answer for anyone else.
  ids.hidden = (await insert('items', { name: `${PREFIX} hidden`, item_type: 'cocktail', bar_id: ids.otherBar, publish_mode: 'private' })).id;
  await recipe('hidden', [['almond']]);

  // The back bar: Tanqueray and Vermouth on the stock list, Campari on the map.
  for (const k of ['tanqueray', 'vermouth']) await insert('back_bar_items', { bar_id: ids.bar, item_id: ids[k], source: 'setup' });
  const zone = await insert('bar_zones', { bar_id: ids.bar, name: `${PREFIX} shelf`, kind: 'shelf' });
  await insert('item_locations', { bar_id: ids.bar, item_id: ids.campari, zone_id: zone.id });
});

after(async () => {
  const like = `%${run}%`;
  for (const user of Object.values(users)) await db.query('DELETE FROM public.home_bar_items WHERE user_id = $1', [user.id]);
  const { rows } = await db.query('SELECT id FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM private.item_flavor_jobs WHERE item_id = ANY($1)', [rows.map((r) => r.id)]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('who can ask', () => {
  test("only the venue's staff, at any role", async () => {
    for (const who of ['outsider', 'otherStaff']) {
      const { error } = await canMake(who);
      assert.equal(error?.code, '42501', who);
    }
    const { error } = await anon.rpc('venue_can_make', { p_bar_id: ids.bar, p_drink_ids: [ids.martini] });
    assert.ok(error, 'signed out cannot ask');
    assert.deepEqual(await canMake('guest'), await canMake('bartender'), 'every member gets the same answer');
  });

  test('the back bar list itself is not readable by members', async () => {
    await db.query('BEGIN');
    try {
      await db.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: users.bartender.id, role: 'authenticated' })]);
      await db.query('SET LOCAL ROLE authenticated');
      await assert.rejects(db.query('SELECT private.venue_back_bar($1)', [ids.bar]), /permission denied/);
    } finally {
      await db.query('ROLLBACK');
    }
  });

  test('a page is at most 100 drinks; none asks nothing', async () => {
    const { error } = await users.guest.client.rpc('venue_can_make', { p_bar_id: ids.bar, p_drink_ids: Array.from({ length: 101 }, () => randomUUID()) });
    assert.equal(error?.code, '22023');
    const { data, error: emptyError } = await users.guest.client.rpc('venue_can_make', { p_bar_id: ids.bar, p_drink_ids: [] });
    assert.ifError(emptyError);
    assert.deepEqual(data, []);
  });
});

describe('the matching', () => {
  test('each drink against the back bar', async () => {
    const got = await canMake('guest');
    assert.deepEqual(got.martini, { can: true, count: 0, missing: [] }, 'a sibling bottle, a twist and an optional line');
    assert.deepEqual(got['gin-syrup'], { can: true, count: 0, missing: [] }, 'a plain line, and syrup from the staples');
    assert.deepEqual(got.plymouth, { can: false, count: 1, missing: ['grin'] }, 'a bottle of another style: buy its style');
    assert.deepEqual(got['old-tom'], { can: false, count: 1, missing: ['oldtum'] }, 'a plain style is bought as itself');
    assert.deepEqual(got.negroni, { can: true, count: 0, missing: [] }, 'what has a spot on the map');
    assert.deepEqual(got['orgeat-sour'], { can: false, count: 1, missing: ['almo'] }, 'house-made stands for its recipe');
    assert.deepEqual(got.far, { can: false, count: 4, missing: ['almo', 'amra', 'falo'] }, 'the first three by name, and the count');
    assert.deepEqual(got['mezcal-sour'], { can: true, count: 0, missing: [] }, "what the bar's own drinks pour");
    assert.deepEqual(got['own-cordial'], { can: true, count: 0, missing: [] }, "the bar's own house-made");
    assert.equal(got['no-spec'], undefined, 'no spec to follow, no answer');
    assert.equal(got.hidden, undefined, "a spec the caller can't read, no answer");
  });

  test("same verdicts as my_bar_drinks with the same shelf at home", async () => {
    const { rows } = await db.query('SELECT id FROM private.venue_back_bar($1) AS id', [ids.bar]);
    await db.query('DELETE FROM public.home_bar_items WHERE user_id = $1', [users.guest.id]);
    for (const r of rows) await db.query('INSERT INTO public.home_bar_items (user_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [users.guest.id, r.id]);
    const { data, error } = await users.guest.client.rpc('my_bar_drinks', { p_after_name: PREFIX, p_limit: 1000, p_two_away: true });
    assert.ifError(error);
    const home = new Map(data.map((r) => [r.id, [r.missing_id, r.missing2_id].filter(Boolean).sort()]));
    const { data: venue } = await users.guest.client.rpc('venue_can_make', { p_bar_id: ids.bar, p_drink_ids: DRINKS.map((k) => ids[k]) });
    for (const v of venue) {
      if (v.missing_count > 2) assert.ok(!home.has(v.drink_id), 'three or more short is off the home list too');
      else assert.deepEqual(v.missing.map((m) => m.id).sort(), home.get(v.drink_id), `drink ${v.drink_id}`);
    }
  });
});
