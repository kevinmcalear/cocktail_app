// Guests see the drawings of the drinks on a bar's menu
// (20261206700000_guest_menu_drawings.sql): anon and a signed-in non-member
// read the drawing (item_sketches) of a drink on a menu get_menu_editions
// shows them, on now or ended, even when the bar hasn't published the drink.
// Nothing else: not a draft, a menu yet to start, a hidden menu, a drink
// waiting to go on, a drink on no menu, another bar's drink, or a page
// guests can't see. Nobody gains a write.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run guest menu drawing tests against a non-local stack: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const ids = {};
let guest;
const DAY = 86400000;
const at = (ms) => new Date(Date.now() + ms).toISOString();

const DRINKS = ['live', 'ended', 'draft', 'future', 'hidden', 'waiting', 'later', 'unlisted', 'theirs', 'otherOnOurs', 'closedPage'];
const inputs = () => ({
  v: 1, glass: 'rocks', ice: 'cubes', method: 'stir', liquid: { hex: '#aa3322', alpha: 0.8 }, foam: null, float: null, bleed: null,
  fizz: false, garnish: null, coverage: 0.6, from: { glass: 'rules', ice: 'rules', method: 'rules', liquid: 'rules', garnish: 'default' },
});

async function insert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

async function menu(key, bar, fields) {
  ids[key] = (await insert('menus', { bar_id: bar, name: `${key} ${run}`, kind: 'menu', ...fields })).id;
}

const onMenu = (menuKey, drinkKey, fields = {}) => insert('menu_drinks', { menu_id: ids[menuKey], item_id: ids[drinkKey], sort_order: 0, ...fields });

before(async () => {
  await db.connect();
  const email = `guest-${run}@guest-drawings-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  guest = { id: data.user.id, client: createClient(status.API_URL, status.ANON_KEY, clientOptions) };
  const { error: signInError } = await guest.client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;

  ids.bar = (await insert('bars', { name: `Drawings bar ${run}` })).id;
  ids.otherBar = (await insert('bars', { name: `Other bar ${run}` })).id;
  ids.closedBar = (await insert('bars', { name: `Closed bar ${run}` })).id;
  ids.profile = (await insert('profiles', { kind: 'bar', handle: `drawings.${run}`, display_name: `Drawings bar ${run}`, bar_id: ids.bar, is_public: true })).id;
  ids.otherProfile = (await insert('profiles', { kind: 'bar', handle: `other.${run}`, display_name: `Other bar ${run}`, bar_id: ids.otherBar, is_public: true })).id;
  // A page guests can't see: not public.
  ids.closedProfile = (await insert('profiles', { kind: 'bar', handle: `closed.${run}`, display_name: `Closed bar ${run}`, bar_id: ids.closedBar, is_public: false })).id;

  // Every drink is unpublished ('private'), so only the new policy could let a guest read its drawing.
  for (const key of DRINKS) {
    const bar = key === 'theirs' || key === 'otherOnOurs' ? ids.otherBar : key === 'closedPage' ? ids.closedBar : ids.bar;
    ids[key] = (await insert('items', { name: `${key} ${run}`, item_type: 'cocktail', bar_id: bar, publish_mode: 'private' })).id;
    await db.query(
      "INSERT INTO public.item_sketches (item_id, inputs, source, spec_fingerprint, rules_version) VALUES ($1, $2, 'rules', 'f', 1) ON CONFLICT (item_id) DO UPDATE SET inputs = EXCLUDED.inputs",
      [ids[key], JSON.stringify(inputs())]
    );
  }

  await menu('liveMenu', ids.bar, { starts_at: at(-30 * DAY) });
  await menu('endedMenu', ids.bar, { starts_at: at(-90 * DAY), ends_at: at(-60 * DAY) });
  await menu('draftMenu', ids.bar, { starts_at: null });
  await menu('futureMenu', ids.bar, { starts_at: at(7 * DAY) });
  await menu('hiddenMenu', ids.bar, { starts_at: at(-30 * DAY), hidden_at: at(-DAY) });
  await menu('closedMenu', ids.closedBar, { starts_at: at(-30 * DAY) });
  await onMenu('liveMenu', 'live');
  await onMenu('endedMenu', 'ended');
  await onMenu('draftMenu', 'draft');
  await onMenu('futureMenu', 'future');
  await onMenu('hiddenMenu', 'hidden');
  await onMenu('liveMenu', 'waiting', { waiting: 'on' });
  await onMenu('liveMenu', 'later', { on_from: at(3 * DAY) });
  // Another bar's drink put on our menu: get_menu_editions leaves it out, so its drawing stays closed.
  await onMenu('liveMenu', 'otherOnOurs');
  await onMenu('closedMenu', 'closedPage');
});

after(async () => {
  for (const key of ['liveMenu', 'endedMenu', 'draftMenu', 'futureMenu', 'hiddenMenu', 'closedMenu']) if (ids[key]) await service.from('menus').delete().eq('id', ids[key]);
  for (const key of DRINKS) if (ids[key]) await service.from('items').delete().eq('id', ids[key]);
  for (const key of ['profile', 'otherProfile', 'closedProfile']) if (ids[key]) await service.from('profiles').delete().eq('id', ids[key]);
  for (const key of ['bar', 'otherBar', 'closedBar']) if (ids[key]) await service.from('bars').delete().eq('id', ids[key]);
  if (guest) await service.auth.admin.deleteUser(guest.id);
  await db.end();
});

async function drawn(client) {
  const { data, error } = await client.from('item_sketches').select('item_id, inputs').in('item_id', DRINKS.map((k) => ids[k]));
  assert.ifError(error);
  const got = new Set(data.map((r) => r.item_id));
  return DRINKS.filter((k) => got.has(ids[k]));
}

for (const [who, client] of [['signed out', () => anon], ['signed in, not on the team', () => guest.client]]) {
  test(`${who}: the drawings of drinks on a menu that is on or has ended, and nothing else`, async () => {
    assert.deepEqual(await drawn(client()), ['live', 'ended']);
  });
}

test('the guest page lists the same drinks the drawings open for', async () => {
  const { data, error } = await anon.rpc('get_menu_editions', { p_profile_id: ids.profile });
  assert.ifError(error);
  const listed = new Set(data.flatMap((e) => e.drinks.map((d) => d.id)));
  assert.deepEqual(DRINKS.filter((k) => listed.has(ids[k])), ['live', 'ended']);
});

test('signed out, only the drawing columns', async () => {
  const { error } = await anon.from('item_sketches').select('source').eq('item_id', ids.live);
  assert.ok(error, 'anon reads item_id and inputs only');
});

test('nobody gains a write', async () => {
  for (const client of [anon, guest.client]) {
    const ins = await client.from('item_sketches').insert({ item_id: ids.unlisted, inputs: inputs(), source: 'rules', spec_fingerprint: 'x', rules_version: 1 });
    assert.ok(ins.error, 'insert refused');
    const upd = await client.from('item_sketches').update({ inputs: { ...inputs(), glass: 'coupe' } }).eq('item_id', ids.live).select();
    assert.ok(upd.error || upd.data.length === 0, 'update refused');
    const del = await client.from('item_sketches').delete().eq('item_id', ids.live).select();
    assert.ok(del.error || del.data.length === 0, 'delete refused');
  }
  const { rows } = await db.query('SELECT inputs->>\'glass\' AS glass FROM public.item_sketches WHERE item_id = $1', [ids.live]);
  assert.notEqual(rows[0].glass, 'coupe');
  assert.equal((await db.query('SELECT 1 FROM public.item_sketches WHERE item_id = $1', [ids.live])).rowCount, 1);
});

test('the policy is read-only', async () => {
  const { rows } = await db.query(
    "SELECT cmd, roles::text[] AS roles FROM pg_policies WHERE schemaname = 'public' AND tablename = 'item_sketches' AND policyname = 'item_sketches_select_on_menu'"
  );
  assert.deepEqual(rows, [{ cmd: 'SELECT', roles: ['anon', 'authenticated'] }]);
});
