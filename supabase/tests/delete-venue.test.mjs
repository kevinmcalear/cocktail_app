// Deleting a venue (E53): only that venue's Admin, with its name typed back.
// What the public could see stays on the bar's page, which goes back to
// unclaimed; what only staff could see goes; picture files are queued
// (supabase/migrations/20261121400000_delete_a_venue.sql).
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
  throw new Error(`Refusing to run venue deletion tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

const users = {};
const ids = {};
const NAME = `Pale Moth ${run}`;

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

/** Fixtures go straight into the database, as the server would write them. */
async function insert(table, fields) {
  const keys = Object.keys(fields);
  const values = keys.map((k) => (fields[k] !== null && typeof fields[k] === 'object' ? JSON.stringify(fields[k]) : fields[k]));
  const sql = `INSERT INTO public.${table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
  return (await db.query(sql, values)).rows[0];
}

const row = async (sql, params) => (await db.query(sql, params)).rows[0];
const exists = async (table, id) => Boolean(await row(`SELECT 1 FROM public.${table} WHERE id = $1`, [id]));
const deleteVenue = (who, barId, name) => users[who].client.rpc('delete_venue', { p_bar_id: barId, p_confirm_name: name });

/** A venue with a claimed public page, as hand_over_claim leaves it. */
async function claimedVenue(name, members) {
  const bar = await insert('bars', { name });
  for (const [who, level] of members) await insert('user_bars', { user_id: users[who].id, bar_id: bar.id, role_level: level });
  const page = await insert('profiles', {
    kind: 'bar',
    handle: `${name.replace(/\W/g, '')}`.toLowerCase(),
    display_name: name,
    is_public: true,
    bar_id: bar.id,
    claimed_at: new Date().toISOString(),
  });
  return { bar: bar.id, page: page.id };
}

before(async () => {
  await db.connect();
  for (const label of ['admin', 'bartender', 'otherAdmin', 'guest', 'soloOwner']) users[label] = await makeUser(label);

  ({ bar: ids.bar, page: ids.page } = await claimedVenue(NAME, [['admin', 40], ['bartender', 30]]));
  ids.otherBar = (await insert('bars', { name: `Little Rye ${run}` })).id;
  await insert('user_bars', { user_id: users.otherAdmin.id, bar_id: ids.otherBar, role_level: 40 });

  // A person credited with the public drink.
  ids.person = (await insert('profiles', { kind: 'person', handle: `maker${run}`, display_name: `Maker ${run}`, is_public: true })).id;

  const drink = (name, mode) =>
    insert('items', { name: `${name} ${run}`, item_type: 'cocktail', bar_id: ids.bar, created_by: users.admin.id, publish_mode: mode });
  ids.publicDrink = (await drink('Moth sour', 'spec')).id;
  // Credited to another bar's page: it still stays on this one.
  ids.otherPage = (await insert('profiles', { kind: 'bar', handle: `rye${run}`, display_name: `Rye page ${run}`, is_public: true })).id;
  await db.query('UPDATE public.items SET creator_profile_id = $1, origin_bar_profile_id = $2 WHERE id = $3', [ids.person, ids.otherPage, ids.publicDrink]);
  ids.privateDrink = (await drink('Staff fizz', 'private')).id;
  const ingredient = (name) =>
    insert('items', { name: `${name} ${run}`, item_type: 'ingredient', bar_id: ids.bar, created_by: users.admin.id });
  ids.houseSyrup = (await ingredient('Moth syrup')).id;
  ids.sharedSyrup = (await ingredient('Moth oleo')).id;
  ids.sharedSyrupPrep = (await insert('items', { name: `Lemon peel ${run}`, item_type: 'ingredient' })).id;
  await insert('recipes', { recipe_item_id: ids.publicDrink, ingredient_item_id: ids.houseSyrup, sort_order: 0 });
  await insert('recipes', { recipe_item_id: ids.privateDrink, ingredient_item_id: ids.houseSyrup, sort_order: 0 });
  await insert('recipes', { recipe_item_id: ids.sharedSyrup, ingredient_item_id: ids.sharedSyrupPrep, sort_order: 0 });

  // Someone else's home drink that uses the venue's oleo.
  ids.guestDrink = (await insert('items', { name: `Guest punch ${run}`, item_type: 'cocktail', created_by: users.guest.id })).id;
  ids.guestLine = (await insert('recipes', { recipe_item_id: ids.guestDrink, ingredient_item_id: ids.sharedSyrup, sort_order: 0 })).id;

  // The guest ranked the public drink at the bar.
  ids.rank = (
    await insert('rank_entries', {
      user_id: users.guest.id,
      item_id: ids.publicDrink,
      ranked_as_item_id: ids.publicDrink,
      sentiment: 'loved',
      rank_key: 1,
      venue_profile_id: ids.page,
    })
  ).id;

  // A started menu (public history) the guest saved, and a draft menu.
  ids.menu = (await insert('menus', { name: `Autumn ${run}`, bar_id: ids.bar, starts_at: '2026-09-01T12:00:00Z' })).id;
  const section = await insert('menu_sections', { menu_id: ids.menu, name: 'Drinks', sort_order: 0 });
  for (const [i, item] of [ids.publicDrink, ids.privateDrink].entries()) {
    await insert('menu_drinks', { menu_id: ids.menu, menu_section_id: section.id, item_id: item, sort_order: i });
  }
  ids.saved = (await insert('saved_menu_editions', { user_id: users.guest.id, menu_id: ids.menu })).id;
  ids.draftMenu = (await insert('menus', { name: `Winter ideas ${run}`, bar_id: ids.bar })).id;
  ids.draft = (await insert('drafts', { user_id: users.admin.id, bar_id: ids.bar, entity_type: 'cocktail', draft_data: {} })).id;

  // The venue's logo file.
  ids.logoPath = `bars/${ids.bar}/logo-${run}.png`;
  const { error: uploadError } = await service.storage.from('drinks').upload(ids.logoPath, png, { contentType: 'image/png' });
  if (uploadError) throw uploadError;
  const logoUrl = service.storage.from('drinks').getPublicUrl(ids.logoPath).data.publicUrl;
  await db.query('UPDATE public.bars SET logo_url = $1 WHERE id = $2', [logoUrl, ids.bar]);

  // A bar its only member leaves behind when deleting their account.
  ({ bar: ids.soloBar, page: ids.soloPage } = await claimedVenue(`Solo ${run}`, [['soloOwner', 40]]));
  ids.soloPublicDrink = (
    await insert('items', { name: `Solo spritz ${run}`, item_type: 'cocktail', bar_id: ids.soloBar, created_by: users.soloOwner.id, publish_mode: 'description' })
  ).id;
  ids.soloPrivateDrink = (
    await insert('items', { name: `Solo secret ${run}`, item_type: 'cocktail', bar_id: ids.soloBar, created_by: users.soloOwner.id, publish_mode: 'private' })
  ).id;
});

after(async () => {
  await service.storage.from('drinks').remove([ids.logoPath]);
  const left = '(SELECT id FROM public.bars WHERE name LIKE $1)';
  await db.query(`DELETE FROM public.drafts WHERE bar_id IN ${left}`, [`%${run}`]);
  await db.query(`DELETE FROM public.menus WHERE bar_id IN ${left}`, [`%${run}`]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [`%${run}`]);
  await db.query('DELETE FROM public.profiles WHERE display_name LIKE $1', [`%${run}`]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [`%${run}`]);
  await db.query('DELETE FROM private.venue_deletions WHERE bar_name LIKE $1', [`%${run}`]);
  await db.query('DELETE FROM private.storage_cleanup WHERE name LIKE $1', [`%${run}%`]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('delete_venue', () => {
  test('signed out cannot delete a venue', async () => {
    const { error } = await anon.rpc('delete_venue', { p_bar_id: ids.bar, p_confirm_name: NAME });
    assert.ok(error);
    assert.equal(await exists('bars', ids.bar), true);
  });

  test('a Bartender of the venue cannot delete it', async () => {
    const { error } = await deleteVenue('bartender', ids.bar, NAME);
    assert.equal(error?.code, '42501');
    assert.equal(await exists('bars', ids.bar), true);
  });

  test('an Admin of another venue cannot delete it', async () => {
    const { error } = await deleteVenue('otherAdmin', ids.bar, NAME);
    assert.equal(error?.code, '42501');
    assert.equal(await exists('bars', ids.bar), true);
  });

  test('the Admin must type the venue name back', async () => {
    for (const name of [`Pale Moth`, '', null]) {
      const { error } = await deleteVenue('admin', ids.bar, name);
      assert.equal(error?.code, '22023', `"${name}" should not match`);
    }
    assert.equal(await exists('bars', ids.bar), true);
  });

  test('staff cannot reach the audit or the file queue', async () => {
    for (const fn of ['storage_cleanup_batch', 'storage_cleanup_done']) {
      const args = fn === 'storage_cleanup_done' ? { p_ids: [1] } : {};
      const { error } = await users.admin.client.rpc(fn, args);
      assert.ok(error, `${fn} should be refused`);
    }
  });

  test('the Admin deletes the venue; what the public saw stays on an unclaimed page', async () => {
    // Case and spaces don't matter.
    const { data, error } = await deleteVenue('admin', ids.bar, `  ${NAME.toUpperCase()} `);
    assert.ifError(error);
    assert.equal(data.drinks_kept, 1);
    assert.equal(data.profile_id, ids.page);

    // The venue and its staff-only things are gone.
    assert.equal(await exists('bars', ids.bar), false);
    assert.equal((await row('SELECT count(*)::int AS n FROM public.user_bars WHERE bar_id = $1', [ids.bar])).n, 0);
    for (const [table, id] of [['menus', ids.menu], ['menus', ids.draftMenu], ['drafts', ids.draft], ['items', ids.privateDrink], ['items', ids.houseSyrup]]) {
      assert.equal(await exists(table, id), false, `${table} ${id} should be gone`);
    }

    // The public drink stays as the page's research drink, with its credit and the guest's ranking.
    const kept = await row('SELECT bar_id, created_by, origin_bar_profile_id, publish_mode, creator_profile_id FROM public.items WHERE id = $1', [ids.publicDrink]);
    assert.deepEqual(kept, { bar_id: null, created_by: null, origin_bar_profile_id: ids.page, publish_mode: 'description', creator_profile_id: ids.person });
    assert.equal(await exists('rank_entries', ids.rank), true);

    // The oleo in the guest's punch stays as a name; its own recipe goes.
    assert.equal((await row('SELECT bar_id FROM public.items WHERE id = $1', [ids.sharedSyrup])).bar_id, null);
    assert.equal(await exists('recipes', ids.guestLine), true);
    assert.equal((await row('SELECT count(*)::int AS n FROM public.recipes WHERE recipe_item_id = $1', [ids.sharedSyrup])).n, 0);

    // The page is unclaimed, and the started menu is its history again, saved copy included.
    assert.deepEqual(await row('SELECT bar_id, claimed_at, is_claimed FROM public.profiles WHERE id = $1', [ids.page]), {
      bar_id: null,
      claimed_at: null,
      is_claimed: false,
    });
    const edition = await row('SELECT id, year, month, is_current FROM public.profile_menu_editions WHERE profile_id = $1', [ids.page]);
    assert.deepEqual([edition.year, edition.month, edition.is_current], [2026, 9, true]);
    const drinks = (await db.query('SELECT item_id FROM public.profile_menu_edition_drinks WHERE edition_id = $1', [edition.id])).rows;
    assert.deepEqual(drinks.map((d) => d.item_id), [ids.publicDrink]);
    assert.deepEqual(await row('SELECT menu_id, edition_id FROM public.saved_menu_editions WHERE id = $1', [ids.saved]), {
      menu_id: null,
      edition_id: edition.id,
    });

    // An audit row.
    const audit = await row('SELECT deleted_by, reason, profile_id FROM private.venue_deletions WHERE bar_id = $1', [ids.bar]);
    assert.deepEqual(audit, { deleted_by: users.admin.id, reason: 'admin', profile_id: ids.page });
  });

  test('the venue logo file is queued and the cleanup removes it', async () => {
    const { data: queued, error } = await service.rpc('storage_cleanup_batch', { p_limit: 1000 });
    assert.ifError(error);
    const logo = queued.find((f) => f.bucket_id === 'drinks' && f.name === ids.logoPath);
    assert.ok(logo, 'the logo should be queued');
    const { error: removeError } = await service.storage.from('drinks').remove([logo.name]);
    assert.ifError(removeError);
    const { error: doneError } = await service.rpc('storage_cleanup_done', { p_ids: [logo.id] });
    assert.ifError(doneError);
    const { data: left } = await service.storage.from('drinks').list(`bars/${ids.bar}`);
    assert.deepEqual(left, []);
  });

  test('a file something still points at leaves the queue without being removed', async () => {
    const path = `bars/${ids.otherBar}/kept-${run}.png`;
    const url = service.storage.from('drinks').getPublicUrl(path).data.publicUrl;
    await db.query('UPDATE public.bars SET logo_url = $1 WHERE id = $2', [url, ids.otherBar]);
    await db.query(`SELECT private.queue_storage_url($1, 'test')`, [url]);
    const { data, error } = await service.rpc('storage_cleanup_batch', { p_limit: 1000 });
    assert.ifError(error);
    assert.equal(data.some((f) => f.name === path), false);
    assert.equal(Boolean(await row('SELECT 1 FROM private.storage_cleanup WHERE name = $1', [path])), false);
  });
});

describe('account deletion removes a solo venue the same way', () => {
  test('the page goes back to unclaimed and its public drink stays', async () => {
    const { error } = await service.rpc('prepare_account_deletion', { p_user_id: users.soloOwner.id });
    assert.ifError(error);
    assert.equal(await exists('bars', ids.soloBar), false);
    assert.equal(await exists('items', ids.soloPrivateDrink), false);
    assert.deepEqual(await row('SELECT bar_id, origin_bar_profile_id FROM public.items WHERE id = $1', [ids.soloPublicDrink]), {
      bar_id: null,
      origin_bar_profile_id: ids.soloPage,
    });
    assert.deepEqual(await row('SELECT bar_id, claimed_at FROM public.profiles WHERE id = $1', [ids.soloPage]), { bar_id: null, claimed_at: null });
    assert.equal((await row('SELECT reason FROM private.venue_deletions WHERE bar_id = $1', [ids.soloBar])).reason, 'account_deleted');
  });
});
