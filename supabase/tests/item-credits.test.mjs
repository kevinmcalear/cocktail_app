// One credit relation (item_credits, decision credit-model): every credit as
// (drink, who, role, status). The backfill matches the five old places;
// every old write (an old build's insert, set_drink_credits, answer_credit,
// stepping off, maker credits, SQL) reaches item_credits; pending, declined
// and unconfirmed maker credits are read only by the party, the drink's
// editors and moderators; nobody writes the table directly; only the party
// answers or disputes, and the drink's editors or a moderator settle a
// dispute; claiming a page and merging two drinks move credits. Runs through
// the real API (and SQL for fixtures) against the local stack.
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
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL) || !/^postgresql:\/\/[^@]+@(127\.0\.0\.1|localhost)[:/]/.test(status.DB_URL)) {
  throw new Error(`Refusing to run credit tests against a non-local stack: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const users = {};
const ids = {};
const items = [];
const profiles = [];

async function makeUser(label) {
  const email = `${label}-${run}@credits-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

const one = async (sql, params = []) => (await db.query(sql, params)).rows[0];

async function page(key, kind, fields = {}) {
  const cols = { kind, handle: `${key}${run}`.toLowerCase(), display_name: `${key} ${run}`, is_public: true, ...fields };
  const names = Object.keys(cols);
  const row = await one(
    `INSERT INTO public.profiles (${names.join(', ')}) VALUES (${names.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    Object.values(cols)
  );
  profiles.push(row.id);
  ids[key] = row.id;
  return row.id;
}

async function drink(key, fields) {
  const cols = { name: `${key} ${run}`, item_type: 'cocktail', ...fields };
  const names = Object.keys(cols);
  const row = await one(
    `INSERT INTO public.items (${names.join(', ')}) VALUES (${names.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
    Object.values(cols)
  );
  items.push(row.id);
  ids[key] = row.id;
  return row.id;
}

/** A page's key in ids, so failures read as names. */
const keyOf = (id) => Object.keys(ids).find((k) => ids[k] === id) ?? id;
const label = (r) => `${r.role}${r.what && r.what !== 'drink' ? `/${r.what}` : ''}:${r.name ?? keyOf(r.profile_id)}:${r.status}`;

/** Every credit on a drink, as the table holds it: by role, then a creator's place, then name. */
const creditsOf = async (itemId) =>
  (await db.query('SELECT role, what, profile_id, name, status, sort_order FROM public.item_credits WHERE item_id = $1', [itemId])).rows
    .map((r) => ({ key: `${r.role}|${r.sort_order}|${label(r)}`, label: label(r) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((r) => r.label);
/** The credits on a drink someone can read. */
const seen = async (who, itemId) => {
  const { data, error } = await users[who].client.from('item_credits').select('role, what, profile_id, name, status').eq('item_id', itemId);
  if (error) throw error;
  return data.map(label).sort();
};
const credit = (itemId, role, profileId, what = 'drink') =>
  one('SELECT * FROM public.item_credits WHERE item_id = $1 AND role = $2 AND profile_id = $3 AND what = $4', [itemId, role, profileId, what]);
const creditId = async (...args) => (await credit(...args))?.id;
const rpc = (who, fn, args) => (who === 'anon' ? anon : users[who].client).rpc(fn, args);
const itemRow = (id) => one('SELECT creator_profile_id, origin_bar_profile_id, credit_status FROM public.items WHERE id = $1', [id]);
const oldCoStatus = async (itemId, profileId) =>
  (await one('SELECT status FROM public.item_co_creators WHERE item_id = $1 AND profile_id = $2', [itemId, profileId]))?.status ?? null;

/** Rows where the old places and item_credits disagree, by place (all 0 when in step). */
async function offStep() {
  return one(`SELECT
    (SELECT count(*) FROM ((SELECT id, creator_profile_id FROM public.items WHERE creator_profile_id IS NOT NULL
        EXCEPT SELECT item_id, profile_id FROM public.item_credits WHERE role = 'creator' AND profile_id IS NOT NULL AND status <> 'declined')
      UNION ALL (SELECT item_id, profile_id FROM public.item_credits WHERE role = 'creator' AND profile_id IS NOT NULL AND status <> 'declined'
        EXCEPT SELECT id, creator_profile_id FROM public.items WHERE creator_profile_id IS NOT NULL)) x)::int AS lead,
    (SELECT count(*) FROM ((SELECT id, origin_bar_profile_id FROM public.items WHERE origin_bar_profile_id IS NOT NULL
        EXCEPT SELECT item_id, profile_id FROM public.item_credits WHERE role = 'bar' AND status <> 'declined')
      UNION ALL (SELECT item_id, profile_id FROM public.item_credits WHERE role = 'bar' AND status <> 'declined'
        EXCEPT SELECT id, origin_bar_profile_id FROM public.items WHERE origin_bar_profile_id IS NOT NULL)) x)::int AS bar,
    (SELECT count(*) FROM ((SELECT id, creator_names FROM public.items WHERE creator_names IS NOT NULL
        EXCEPT SELECT item_id, array_agg(name ORDER BY sort_order) FROM public.item_credits WHERE name IS NOT NULL GROUP BY item_id)
      UNION ALL (SELECT item_id, array_agg(name ORDER BY sort_order) FROM public.item_credits WHERE name IS NOT NULL GROUP BY item_id
        EXCEPT SELECT id, creator_names FROM public.items WHERE creator_names IS NOT NULL)) x)::int AS names,
    ((SELECT count(*) FROM ((SELECT item_id, profile_id FROM public.item_co_creators
        EXCEPT SELECT item_id, profile_id FROM public.item_credits WHERE role = 'co_creator')
      UNION ALL (SELECT item_id, profile_id FROM public.item_credits WHERE role = 'co_creator'
        EXCEPT SELECT item_id, profile_id FROM public.item_co_creators)) x)
     + (SELECT count(*) FROM public.item_co_creators o
        JOIN public.item_credits n ON n.item_id = o.item_id AND n.role = 'co_creator' AND n.profile_id = o.profile_id
        WHERE n.status IN ('pending', 'accepted', 'declined') AND n.status <> o.status::text))::int AS co,
    ((SELECT count(*) FROM ((SELECT item_id, profile_id, makes FROM public.item_maker_credits
        EXCEPT SELECT item_id, profile_id, what FROM public.item_credits WHERE role = 'maker' AND status <> 'declined')
      UNION ALL (SELECT item_id, profile_id, what FROM public.item_credits WHERE role = 'maker' AND status <> 'declined'
        EXCEPT SELECT item_id, profile_id, makes FROM public.item_maker_credits)) x)
     + (SELECT count(*) FROM public.item_maker_credits o
        JOIN public.item_credits n ON n.item_id = o.item_id AND n.role = 'maker' AND n.what = o.makes AND n.profile_id = o.profile_id
        WHERE n.status IN ('pending', 'accepted', 'verified') AND (o.confirmed_at IS NOT NULL) <> (n.status IN ('accepted', 'verified'))))::int AS makers`);
}
const IN_STEP = { lead: 0, bar: 0, names: 0, co: 0, makers: 0 };

before(async () => {
  await db.connect();
  for (const label of ['editor', 'bartender', 'jo', 'pat', 'stranger', 'moderator', 'barTeam', 'makerTeam']) users[label] = await makeUser(label);
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [users.moderator.id]);
  for (const [key, name] of [['venue', 'Credit Venue'], ['guestBar', 'Credit Guest Bar'], ['iceTeam', 'Credit Ice Team']]) {
    ids[key] = (await one('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`${name} ${run}`])).id;
  }
  await db.query(
    'INSERT INTO public.user_bars (user_id, bar_id, role_level) VALUES ($1, $5, 40), ($2, $5, 20), ($3, $6, 40), ($4, $7, 40)',
    [users.editor.id, users.bartender.id, users.barTeam.id, users.makerTeam.id, ids.venue, ids.guestBar, ids.iceTeam]
  );
  await page('ed', 'person', { user_id: users.editor.id });
  await page('jo', 'person', { user_id: users.jo.id });
  await page('sam', 'person'); // a page nobody has claimed
  await page('patPage', 'person'); // the page Pat claims
  await page('patOwn', 'person', { user_id: users.pat.id });
  await page('barPage', 'bar', { bar_id: ids.guestBar, makes: ['glassware'] });
  await page('makerPage', 'maker', { bar_id: ids.iceTeam, makes: ['ice', 'glassware'] });
  // A venue drink Ed made, and a shared drink that lives on the guest bar's page.
  await drink('drink', { bar_id: ids.venue, creator_profile_id: ids.ed, credit_status: 'suggested' });
  await drink('shared', { origin_bar_profile_id: ids.barPage });
});

after(async () => {
  await db.query('DELETE FROM public.items WHERE id = ANY($1::uuid[])', [items]);
  await db.query('DELETE FROM public.profiles WHERE id = ANY($1::uuid[])', [profiles]);
  await db.query('DELETE FROM public.bars WHERE id = ANY($1::uuid[])', [[ids.venue, ids.guestBar, ids.iceTeam].filter(Boolean)]);
  const userIds = Object.values(users).map((u) => u.id);
  await db.query('DELETE FROM private.app_admins WHERE user_id = ANY($1::uuid[])', [userIds]);
  for (const id of userIds) await service.auth.admin.deleteUser(id);
  await db.end();
});

describe('the backfill and old writes', () => {
  test('every credit in the old places has its row in item_credits, and nothing else', async () => {
    assert.deepEqual(await offStep(), IN_STEP);
    assert.deepEqual(await creditsOf(ids.drink), ['creator:ed:suggested']);
    assert.deepEqual(await creditsOf(ids.shared), ['bar:barPage:suggested']);
  });

  test("an old build's new drink: its creator, plain names and claim arrive", async () => {
    const { data, error } = await users.editor.client
      .from('items')
      .insert({
        name: `Made ${run}`, item_type: 'cocktail', bar_id: ids.venue, created_by: users.editor.id,
        creator_profile_id: ids.ed, creator_names: ['Harry Craddock', 'Ada Coleman'], credit_status: 'claimed',
      })
      .select('id')
      .single();
    assert.ifError(error);
    ids.made = data.id;
    items.push(data.id);
    assert.deepEqual(await creditsOf(ids.made), ['creator:ed:accepted', 'creator:Harry Craddock:suggested', 'creator:Ada Coleman:suggested']);
  });

  test('set_drink_credits moves the lead, the plain names and the co-creators', async () => {
    const set = (args) => rpc('editor', 'set_drink_credits', { p_item_id: ids.drink, p_creator_profile_id: null, p_creator_names: null, p_add: [], p_remove: [], ...args });
    assert.ifError((await set({ p_creator_profile_id: ids.jo, p_creator_names: ['Harry Craddock'], p_add: [ids.sam] })).error);
    assert.deepEqual(await creditsOf(ids.drink), ['co_creator:sam:pending', 'creator:jo:suggested', 'creator:Harry Craddock:suggested']);
    assert.ifError((await set({ p_creator_profile_id: ids.ed, p_remove: [ids.sam] })).error);
    assert.deepEqual(await creditsOf(ids.drink), ['creator:ed:suggested']);
  });

  test('item_co_creators: naming, answer_credit and stepping off arrive', async () => {
    assert.ifError((await users.editor.client.from('item_co_creators').insert({ item_id: ids.drink, profile_id: ids.jo })).error);
    assert.equal((await credit(ids.drink, 'co_creator', ids.jo)).status, 'pending');
    const yes = await rpc('jo', 'answer_credit', { p_item_id: ids.drink, p_accept: true });
    assert.equal(yes.data, 'accepted');
    assert.equal((await credit(ids.drink, 'co_creator', ids.jo)).status, 'accepted');

    // Jo can open the shared drink, so can step off it.
    assert.ifError((await users.barTeam.client.from('item_co_creators').insert({ item_id: ids.shared, profile_id: ids.jo })).error);
    assert.equal((await credit(ids.shared, 'co_creator', ids.jo)).status, 'pending');
    await users.jo.client.from('item_co_creators').delete().eq('item_id', ids.shared).eq('profile_id', ids.jo);
    assert.equal(await credit(ids.shared, 'co_creator', ids.jo), undefined);
  });

  test("item_maker_credits: crediting, confirm_maker_credit and the maker's old no arrive", async () => {
    assert.ifError((await users.editor.client.from('item_maker_credits').insert({ item_id: ids.drink, profile_id: ids.makerPage, makes: 'ice' })).error);
    assert.equal((await credit(ids.drink, 'maker', ids.makerPage, 'ice')).status, 'pending');
    assert.ifError((await rpc('makerTeam', 'confirm_maker_credit', { p_item_id: ids.drink, p_profile_id: ids.makerPage, p_makes: 'ice' })).error);
    assert.equal((await credit(ids.drink, 'maker', ids.makerPage, 'ice')).status, 'accepted');
    await users.makerTeam.client.from('item_maker_credits').delete().eq('item_id', ids.drink).eq('profile_id', ids.makerPage);
    assert.equal(await credit(ids.drink, 'maker', ids.makerPage, 'ice'), undefined);
    // set_maker_credit is the new app's call for it.
    assert.ifError((await rpc('editor', 'set_maker_credit', { p_item_id: ids.drink, p_profile_id: ids.makerPage, p_what: 'ice', p_credited: true })).error);
    assert.equal((await credit(ids.drink, 'maker', ids.makerPage, 'ice')).status, 'pending');
  });

  test('database code writing the first bar and the shared status arrives (no column list to miss)', async () => {
    await db.query('UPDATE public.items SET origin_bar_profile_id = $2 WHERE id = $1', [ids.drink, ids.barPage]);
    assert.equal((await credit(ids.drink, 'bar', ids.barPage)).status, 'suggested');
    await db.query("UPDATE public.items SET credit_status = 'verified' WHERE id = $1", [ids.drink]);
    assert.equal((await credit(ids.drink, 'creator', ids.ed)).status, 'verified', 'one status reached both');
    assert.equal((await credit(ids.drink, 'bar', ids.barPage)).status, 'verified');
    await db.query("UPDATE public.items SET origin_bar_profile_id = NULL, credit_status = 'suggested' WHERE id = $1", [ids.drink]);
    assert.equal(await credit(ids.drink, 'bar', ids.barPage), undefined);
    assert.equal((await credit(ids.drink, 'creator', ids.ed)).status, 'suggested');
    assert.deepEqual(await offStep(), IN_STEP);
  });
});

describe('who reads credits', () => {
  test('setup: Sam waits on the drink, and so does the ice maker', async () => {
    assert.ifError((await rpc('editor', 'set_drink_credits', { p_item_id: ids.drink, p_creator_profile_id: ids.ed, p_creator_names: null, p_add: [ids.sam], p_remove: [] })).error);
    assert.deepEqual(await creditsOf(ids.drink), ['co_creator:jo:accepted', 'co_creator:sam:pending', 'creator:ed:suggested', 'maker/ice:makerPage:pending']);
  });

  test("a stranger reads the shown credits of a drink they can open, and nothing of one they can't", async () => {
    assert.deepEqual(await seen('stranger', ids.shared), ['bar:barPage:suggested']);
    assert.deepEqual(await seen('stranger', ids.drink), []);
  });

  test("pending credits and unconfirmed maker credits: the party, the drink's editors and moderators only", async () => {
    assert.deepEqual(await seen('bartender', ids.drink), ['co_creator:jo:accepted', 'creator:ed:suggested'], 'the venue’s junior staff see the shown ones');
    assert.deepEqual(await seen('editor', ids.drink), ['co_creator:jo:accepted', 'co_creator:sam:pending', 'creator:ed:suggested', 'maker/ice:makerPage:pending']);
    assert.deepEqual(await seen('makerTeam', ids.drink), ['maker/ice:makerPage:pending'], 'the maker’s team sees its own, on a drink it can’t open');
    assert.deepEqual(await seen('jo', ids.drink), ['co_creator:jo:accepted'], 'and so does the person named');
  });

  test('signed out, item_credits reads nothing', async () => {
    const { data } = await anon.from('item_credits').select('id').eq('item_id', ids.shared);
    assert.deepEqual(data ?? [], []);
  });

  test('nobody writes item_credits directly, not even the party or an editor', async () => {
    const add = await users.editor.client.from('item_credits').insert({ item_id: ids.drink, role: 'co_creator', profile_id: ids.patOwn });
    assert.ok(add.error);
    const bump = await users.editor.client.from('item_credits').update({ status: 'verified' }).eq('item_id', ids.drink).select('id');
    assert.ok(bump.error || !bump.data?.length);
    const own = await users.jo.client.from('item_credits').update({ status: 'declined' }).eq('item_id', ids.drink).select('id');
    assert.ok(own.error || !own.data?.length);
    const off = await users.editor.client.from('item_credits').delete().eq('item_id', ids.drink).select('id');
    assert.ok(off.error || !off.data?.length);
    assert.deepEqual(await creditsOf(ids.drink), ['co_creator:jo:accepted', 'co_creator:sam:pending', 'creator:ed:suggested', 'maker/ice:makerPage:pending']);
  });
});

describe('answering a credit (answer_item_credit)', () => {
  test('only the party named answers', async () => {
    const sam = await creditId(ids.drink, 'co_creator', ids.sam);
    for (const who of ['stranger', 'editor', 'moderator', 'jo', 'anon']) {
      const { error } = await rpc(who, 'answer_item_credit', { p_credit_id: sam, p_accept: true });
      assert.ok(error, `${who} isn’t Sam`);
    }
    assert.equal((await credit(ids.drink, 'co_creator', ids.sam)).status, 'pending');
  });

  test("a maker's team says yes from its inbox, and the old row is confirmed", async () => {
    const inbox = await rpc('makerTeam', 'maker_credit_requests', { p_bar_id: ids.iceTeam });
    assert.ifError(inbox.error);
    const ice = await creditId(ids.drink, 'maker', ids.makerPage, 'ice');
    assert.deepEqual(inbox.data.map((r) => [r.item_id, r.makes, r.credit_id]), [[ids.drink, 'ice', ice]]);
    assert.ok((await rpc('editor', 'answer_item_credit', { p_credit_id: ice, p_accept: true })).error, 'the drink’s editor isn’t the maker');
    assert.equal((await rpc('makerTeam', 'answer_item_credit', { p_credit_id: ice, p_accept: true })).data, 'accepted');
    assert.ok((await one('SELECT confirmed_at FROM public.item_maker_credits WHERE item_id = $1 AND profile_id = $2', [ids.drink, ids.makerPage])).confirmed_at);
  });

  test('a lead creator and a first bar answer too; the old status reads claimed', async () => {
    assert.equal((await rpc('editor', 'answer_item_credit', { p_credit_id: await creditId(ids.drink, 'creator', ids.ed), p_accept: true })).data, 'accepted');
    assert.equal((await itemRow(ids.drink)).credit_status, 'claimed');
    const bar = await creditId(ids.shared, 'bar', ids.barPage);
    assert.equal((await rpc('barTeam', 'answer_item_credit', { p_credit_id: bar, p_accept: true })).data, 'accepted');
    assert.equal((await itemRow(ids.shared)).credit_status, 'claimed');
    const no = await rpc('barTeam', 'answer_item_credit', { p_credit_id: bar, p_accept: false });
    assert.match(no.error?.message ?? '', /lives on your bar/, 'a shared drink’s home bar disputes instead');
  });

  test('a bar page that makes glassware sees its request and confirms it', async () => {
    assert.ifError((await rpc('editor', 'set_maker_credit', { p_item_id: ids.drink, p_profile_id: ids.barPage, p_what: 'glassware', p_credited: true })).error);
    const inbox = await rpc('barTeam', 'maker_credit_requests', { p_bar_id: ids.guestBar });
    assert.deepEqual(inbox.data.map((r) => r.makes), ['glassware']);
    assert.equal((await rpc('barTeam', 'answer_item_credit', { p_credit_id: inbox.data[0].credit_id, p_accept: true })).data, 'accepted');
    assert.ok((await one('SELECT confirmed_at FROM public.item_maker_credits WHERE item_id = $1 AND profile_id = $2', [ids.drink, ids.barPage])).confirmed_at);
  });

  test('a no sticks: hidden, and nobody names them there again until they say yes', async () => {
    const ice = await creditId(ids.drink, 'maker', ids.makerPage, 'ice');
    assert.equal((await rpc('makerTeam', 'answer_item_credit', { p_credit_id: ice, p_accept: false })).data, 'declined');
    assert.equal((await one('SELECT count(*)::int AS n FROM public.item_maker_credits WHERE item_id = $1 AND profile_id = $2', [ids.drink, ids.makerPage])).n, 0, 'old builds stop showing it');
    assert.ok(!(await seen('bartender', ids.drink)).some((c) => c.startsWith('maker/ice')));
    const again = await rpc('editor', 'set_maker_credit', { p_item_id: ids.drink, p_profile_id: ids.makerPage, p_what: 'ice', p_credited: true });
    assert.match(again.error?.message ?? '', /said no/);
    const oldBuild = await users.editor.client.from('item_maker_credits').insert({ item_id: ids.drink, profile_id: ids.makerPage, makes: 'ice' });
    assert.match(oldBuild.error?.message ?? '', /said no/);
    assert.equal((await rpc('makerTeam', 'answer_item_credit', { p_credit_id: ice, p_accept: true })).data, 'accepted');
    assert.ok((await one('SELECT confirmed_at FROM public.item_maker_credits WHERE item_id = $1 AND profile_id = $2', [ids.drink, ids.makerPage])).confirmed_at, 'and the old row is back');

    const lead = await creditId(ids.made, 'creator', ids.ed);
    assert.equal((await rpc('editor', 'answer_item_credit', { p_credit_id: lead, p_accept: false })).data, 'declined');
    assert.equal((await itemRow(ids.made)).creator_profile_id, null);
    const rename = await rpc('editor', 'set_drink_credits', { p_item_id: ids.made, p_creator_profile_id: ids.ed, p_creator_names: null, p_add: [], p_remove: [] });
    assert.match(rename.error?.message ?? '', /isn't theirs/);
    assert.equal((await rpc('editor', 'answer_item_credit', { p_credit_id: lead, p_accept: true })).data, 'accepted');
    assert.deepEqual(await itemRow(ids.made), { creator_profile_id: ids.ed, origin_bar_profile_id: null, credit_status: 'claimed' });
    assert.deepEqual(await offStep(), IN_STEP);
  });
});

describe('disputing and settling', () => {
  test('only the party named disputes, with a note, and not while it waits for an answer', async () => {
    const jo = await creditId(ids.drink, 'co_creator', ids.jo);
    for (const who of ['stranger', 'editor', 'anon']) {
      const { error } = await rpc(who, 'dispute_credit', { p_credit_id: jo, p_note: 'Not right' });
      assert.ok(error, `${who} isn’t Jo`);
    }
    assert.ifError((await rpc('editor', 'set_drink_credits', { p_item_id: ids.drink, p_creator_profile_id: ids.ed, p_creator_names: null, p_add: [ids.patOwn], p_remove: [] })).error);
    const waiting = await rpc('pat', 'dispute_credit', { p_credit_id: await creditId(ids.drink, 'co_creator', ids.patOwn), p_note: 'Hmm' });
    assert.match(waiting.error?.message ?? '', /yes or no/);
    assert.match((await rpc('jo', 'dispute_credit', { p_credit_id: jo, p_note: '   ' })).error?.message ?? '', /what's wrong/);
    assert.match((await rpc('jo', 'dispute_credit', { p_credit_id: jo, p_note: 'x'.repeat(501) })).error?.message ?? '', /500/);
  });

  test('a dispute flags the credit, keeps the old place as it was, and shows', async () => {
    const jo = await creditId(ids.drink, 'co_creator', ids.jo);
    assert.equal((await rpc('jo', 'dispute_credit', { p_credit_id: jo, p_note: 'I made it at another bar' })).data, 'disputed');
    const row = await credit(ids.drink, 'co_creator', ids.jo);
    assert.equal(row.disputed_by, users.jo.id);
    assert.equal(row.dispute_note, 'I made it at another bar');
    assert.equal(await oldCoStatus(ids.drink, ids.jo), 'accepted');
    assert.ok((await seen('bartender', ids.drink)).includes('co_creator:jo:disputed'));
    assert.match((await rpc('jo', 'dispute_credit', { p_credit_id: jo, p_note: 'Again' })).error?.message ?? '', /already disputed/);
  });

  test("the drink's editors or a moderator settle it; kept by an editor, it asks Jo again", async () => {
    const jo = await creditId(ids.drink, 'co_creator', ids.jo);
    for (const who of ['stranger', 'jo', 'bartender', 'anon']) {
      const { error } = await rpc(who, 'resolve_credit_dispute', { p_credit_id: jo, p_keep: true });
      assert.ok(error, `${who} can’t settle it`);
    }
    assert.equal((await rpc('editor', 'resolve_credit_dispute', { p_credit_id: jo, p_keep: true })).data, 'pending');
    assert.equal(await oldCoStatus(ids.drink, ids.jo), 'pending');
    const toCheck = await rpc('jo', 'credits_to_check', {});
    assert.deepEqual(toCheck.data.map((r) => [r.item_id, r.credit_id]), [[ids.drink, jo]]);
  });

  test('not kept: declined, hidden, and not named again', async () => {
    const jo = await creditId(ids.drink, 'co_creator', ids.jo);
    assert.equal((await rpc('jo', 'answer_item_credit', { p_credit_id: jo, p_accept: true })).data, 'accepted');
    assert.equal((await rpc('jo', 'dispute_credit', { p_credit_id: jo, p_note: 'Not my recipe' })).data, 'disputed');
    assert.equal((await rpc('moderator', 'resolve_credit_dispute', { p_credit_id: jo, p_keep: false })).data, 'declined');
    assert.equal(await oldCoStatus(ids.drink, ids.jo), 'declined');
    assert.ok(!(await seen('bartender', ids.drink)).some((c) => c.includes(':jo:')));
    const again = await rpc('editor', 'set_drink_credits', { p_item_id: ids.drink, p_creator_profile_id: ids.ed, p_creator_names: null, p_add: [ids.jo], p_remove: [] });
    assert.ok(again.error);
  });

  test("a lead's dispute drops the old status to suggested; a moderator who keeps it verifies it", async () => {
    const lead = await creditId(ids.drink, 'creator', ids.ed);
    assert.equal((await rpc('editor', 'dispute_credit', { p_credit_id: lead, p_note: 'The year is wrong' })).data, 'disputed');
    assert.equal((await itemRow(ids.drink)).credit_status, 'suggested');
    assert.equal((await rpc('moderator', 'resolve_credit_dispute', { p_credit_id: lead, p_keep: true })).data, 'verified');
    assert.equal((await itemRow(ids.drink)).credit_status, 'verified');
  });

  test("only a moderator takes a shared drink off the bar whose page it lives on, and that no sticks", async () => {
    const bar = await creditId(ids.shared, 'bar', ids.barPage);
    assert.equal((await rpc('barTeam', 'dispute_credit', { p_credit_id: bar, p_note: 'Not ours' })).data, 'disputed');
    assert.match((await rpc('barTeam', 'resolve_credit_dispute', { p_credit_id: bar, p_keep: false })).error?.message ?? '', /Only a moderator/);
    assert.equal((await rpc('barTeam', 'resolve_credit_dispute', { p_credit_id: bar, p_keep: true })).data, 'suggested');
    assert.equal((await rpc('barTeam', 'dispute_credit', { p_credit_id: bar, p_note: 'Really not ours' })).data, 'disputed');
    assert.equal((await rpc('moderator', 'resolve_credit_dispute', { p_credit_id: bar, p_keep: false })).data, 'declined');
    assert.equal((await itemRow(ids.shared)).origin_bar_profile_id, null);
    // Database code crediting the bar again: the no stays, and so does the empty old place.
    await db.query('UPDATE public.items SET origin_bar_profile_id = $2 WHERE id = $1', [ids.shared, ids.barPage]);
    assert.equal((await itemRow(ids.shared)).origin_bar_profile_id, null);
    assert.deepEqual(await offStep(), IN_STEP);
  });
});

describe('merges', () => {
  test("claiming a page moves every credit on it, even one only item_credits holds", async () => {
    await drink('patDrink', { creator_profile_id: ids.patPage, credit_status: 'suggested' });
    assert.ifError((await rpc('editor', 'set_drink_credits', { p_item_id: ids.drink, p_creator_profile_id: ids.ed, p_creator_names: null, p_add: [ids.patPage], p_remove: [] })).error);
    // A no the page gave, which the old places don't hold.
    await db.query("INSERT INTO public.item_credits (item_id, role, profile_id, status) VALUES ($1, 'creator', $2, 'declined')", [ids.shared, ids.patPage]);

    await db.query('SELECT private.merge_person_profile($1, $2, NULL, NULL)', [ids.patPage, ids.patOwn]);
    profiles.splice(profiles.indexOf(ids.patPage), 1);
    assert.equal((await one('SELECT count(*)::int AS n FROM public.item_credits WHERE profile_id = $1', [ids.patPage])).n, 0);
    assert.equal((await credit(ids.patDrink, 'creator', ids.patOwn)).status, 'suggested');
    assert.equal((await itemRow(ids.patDrink)).creator_profile_id, ids.patOwn);
    assert.equal((await credit(ids.shared, 'creator', ids.patOwn)).status, 'declined');
    assert.equal((await one("SELECT count(*)::int AS n FROM public.item_credits WHERE item_id = $1 AND role = 'co_creator' AND profile_id = $2", [ids.drink, ids.patOwn])).n, 1, 'named twice, once now');
    const merge = await one('SELECT dropped FROM private.profile_merges WHERE from_profile_id = $1', [ids.patPage]);
    assert.ok(merge.dropped.item_co_creators, 'the duplicate co-credit is kept in the record');
  });

  test("merging two drinks moves co-creators and makers; the kept drink keeps its own creator and bar", async () => {
    await drink('mergeFrom', { bar_id: ids.venue, creator_profile_id: ids.sam, origin_bar_profile_id: ids.barPage });
    await drink('mergeInto', { bar_id: ids.venue, creator_profile_id: ids.ed });
    await db.query('INSERT INTO public.item_co_creators (item_id, profile_id) VALUES ($1, $2)', [ids.mergeFrom, ids.ed]);
    await db.query("INSERT INTO public.item_maker_credits (item_id, profile_id, makes) VALUES ($1, $2, 'glassware')", [ids.mergeFrom, ids.makerPage]);

    await db.query('SELECT private.merge_item($1, $2)', [ids.mergeFrom, ids.mergeInto]);
    assert.deepEqual(await creditsOf(ids.mergeInto), ['co_creator:ed:accepted', 'creator:ed:suggested', 'maker/glassware:makerPage:pending']);
    assert.deepEqual(await creditsOf(ids.mergeFrom), []);
    assert.deepEqual(await itemRow(ids.mergeInto), { creator_profile_id: ids.ed, origin_bar_profile_id: null, credit_status: 'suggested' });
  });

  test('after all of it, the old places and item_credits still agree', async () => {
    assert.deepEqual(await offStep(), IN_STEP);
  });
});
