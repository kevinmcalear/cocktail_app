// One based-on link and one family (the one-home migration, section "One
// based-on link and one family"): items.based_on_id, based_on_style_id and
// based_on_kind hold what riff_of_id, lineage_parent_id, lineage_style_id
// and spec_from_id held, and items.drink_family (the family's name, any family)
// what lineage_family and family_id held. The old columns stay in step both ways (based_on_sync) until old
// builds are gone: an old build's write fills the new columns, a new
// build's fills the old ones, and an old build saving the family_id it
// loaded changes nothing. The guards that watch the old columns judge the
// new ones too, and a merge moves the new link. Runs through the real API,
// and SQL where a guard sits behind RLS, against the local stack.
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
  throw new Error(`Refusing to run lineage tests against a non-local stack: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });
const users = {};
const ids = {};
const items = [];

async function makeUser(label) {
  const email = `${label}-${run}@lineage-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

async function insert(table, row) {
  const { data, error } = await service.from(table).insert(row).select().single();
  if (error) throw new Error(`fixture insert into ${table} failed: ${error.message}`);
  return data;
}

async function item(key, row) {
  ids[key] = (await insert('items', { item_type: 'cocktail', ...row, name: `${row.name ?? key} ${run}` })).id;
  items.push(ids[key]);
  return ids[key];
}

const row = async (id) => (await db.query('SELECT * FROM public.items WHERE id = $1', [id])).rows[0];
const nameOf = async (familyItemId) =>
  (await db.query('SELECT name FROM public.items WHERE id = $1', [familyItemId])).rows[0]?.name ?? null;

/** The editor's update through the API: refused, or exactly one row changed. */
async function edit(id, fields) {
  return users.editor.client.from('items').update(fields).eq('id', id).select('id');
}
async function editOk(id, fields) {
  const { data, error } = await edit(id, fields);
  assert.ifError(error);
  assert.equal(data.length, 1, 'the editor can change this drink');
}

before(async () => {
  await db.connect();
  users.editor = await makeUser('editor');
  ids.bar = (await insert('bars', { name: `Lineage bar ${run}` })).id;
  await insert('user_bars', { user_id: users.editor.id, bar_id: ids.bar, role_level: 40 });
  ids.sourStyle = (await db.query("SELECT id FROM public.drink_styles WHERE key = 'sour'")).rows[0].id;

  // Old-style rows, as seeds and old builds write them.
  await item('classicA', { name: 'Lineage Classic A', is_catalog: true });
  await item('classicB', { name: 'Lineage Classic B', is_catalog: true });
  await item('child', { name: 'Lineage Child', is_catalog: true, lineage_parent_id: ids.classicA, lineage_family: 'sour' });
  await item('fromStyle', { name: 'Lineage From Style', is_catalog: true, lineage_style_id: ids.sourStyle, lineage_family: 'sour' });
  await item('riff', { name: 'Lineage Riff', riff_of_id: ids.classicA });
  await item('filled', { name: 'Lineage Filled', riff_of_id: ids.classicA });
  await db.query("UPDATE public.items SET spec_source = 'classic', spec_from_id = $2 WHERE id = $1", [ids.filled, ids.classicA]);
  await item('venue', { name: 'Lineage House Sour', bar_id: ids.bar });
  await item('venue2', { name: 'Lineage House Twist', bar_id: ids.bar });
  // The editor's Family row picks from 'family' items (venue ones here, so they're picked first).
  for (const [key, name] of [['sour', 'Sour'], ['sipper', 'Sipper'], ['tiki', 'Tiki']]) {
    ids[key] = (await insert('items', { name, item_type: 'family', bar_id: ids.bar })).id;
    items.push(ids[key]);
  }
});

after(async () => {
  for (const id of items.slice().reverse()) await service.from('items').delete().eq('id', id);
  if (ids.bar) await service.from('bars').delete().eq('id', ids.bar);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('the backfill', () => {
  test('every drink says the same thing in the old columns and the new', async () => {
    const { rows } = await db.query(`
      SELECT count(*)::int AS n FROM public.items
       WHERE riff_of_id IS DISTINCT FROM CASE WHEN based_on_kind = 'riff' THEN based_on_id END
          OR lineage_parent_id IS DISTINCT FROM CASE WHEN based_on_kind = 'descends' THEN based_on_id END
          OR lineage_style_id IS DISTINCT FROM CASE WHEN based_on_kind = 'style' THEN based_on_style_id END
          OR (spec_from_id IS NOT NULL AND spec_from_id IS DISTINCT FROM based_on_id)
          OR (lineage_family IS NOT NULL AND lineage_family IS DISTINCT FROM private.family_key(drink_family))`);
    assert.equal(rows[0].n, 0);
  });

  test("the seed's links and families came across, one kind each", async () => {
    const { rows } = await db.query(`
      SELECT count(*) FILTER (WHERE riff_of_id IS NOT NULL)::int AS riffs,
             count(*) FILTER (WHERE based_on_kind = 'riff')::int AS riff_links,
             count(*) FILTER (WHERE lineage_parent_id IS NOT NULL)::int AS parents,
             count(*) FILTER (WHERE based_on_kind = 'descends')::int AS descends_links,
             count(*) FILTER (WHERE lineage_style_id IS NOT NULL)::int AS styles,
             count(*) FILTER (WHERE based_on_kind = 'style')::int AS style_links,
             count(*) FILTER (WHERE lineage_family IS NOT NULL)::int AS tree_families,
             count(*) FILTER (WHERE private.family_key(drink_family) = lineage_family)::int AS families
      FROM public.items`);
    const r = rows[0];
    assert.ok(r.riffs >= 3000 && r.parents >= 300 && r.styles >= 150, `expected the seed's lineage, found ${JSON.stringify(r)}`);
    assert.equal(r.riff_links, r.riffs);
    assert.equal(r.descends_links, r.parents);
    assert.equal(r.style_links, r.styles);
    assert.equal(r.families, r.tree_families);
  });

  test('old-style rows written by SQL fill the new columns', async () => {
    const child = await row(ids.child);
    assert.deepEqual([child.based_on_id, child.based_on_style_id, child.based_on_kind, child.drink_family], [ids.classicA, null, 'descends', 'Sour'], "the tree's key, by its name");
    const fromStyle = await row(ids.fromStyle);
    assert.deepEqual([fromStyle.based_on_id, fromStyle.based_on_style_id, fromStyle.based_on_kind], [null, ids.sourStyle, 'style']);
    const riff = await row(ids.riff);
    assert.deepEqual([riff.based_on_id, riff.based_on_kind, riff.drink_family], [ids.classicA, 'riff', null]);
    const filled = await row(ids.filled);
    assert.deepEqual([filled.based_on_id, filled.spec_source, filled.spec_from_id], [ids.classicA, 'classic', ids.classicA]);
  });
});

describe('old builds and new builds', () => {
  test("an old build linking a classic (riff_of_id) sets the based-on link, and unlinking clears it", async () => {
    await editOk(ids.venue, { riff_of_id: ids.classicA });
    let v = await row(ids.venue);
    assert.deepEqual([v.based_on_id, v.based_on_kind], [ids.classicA, 'riff']);
    await editOk(ids.venue, { riff_of_id: null });
    v = await row(ids.venue);
    assert.deepEqual([v.based_on_id, v.based_on_kind], [null, null]);
  });

  test('a new build writing based_on_id fills riff_of_id (a link without a kind is a riff)', async () => {
    await editOk(ids.venue, { based_on_id: ids.classicB });
    let v = await row(ids.venue);
    assert.deepEqual([v.riff_of_id, v.based_on_kind, v.lineage_parent_id], [ids.classicB, 'riff', null]);
    await editOk(ids.venue, { based_on_id: ids.classicA, based_on_kind: 'riff' });
    v = await row(ids.venue);
    assert.equal(v.riff_of_id, ids.classicA);
  });

  test('a write that changes both sides must have them agree', async () => {
    // It's based on Classic A now; only a value that changes counts as written.
    const { error } = await edit(ids.venue, { riff_of_id: ids.classicB, based_on_id: ids.riff });
    assert.ok(error, 'two different parents in one write');
    assert.equal((await row(ids.venue)).based_on_id, ids.classicA, 'nothing changed');
  });

  test("a new link on a drink with a copied spec makes the spec the bar's", async () => {
    await db.query("UPDATE public.items SET riff_of_id = $2, spec_source = 'classic' WHERE id = $1", [ids.venue2, ids.classicA]);
    assert.equal((await row(ids.venue2)).spec_from_id, ids.classicA, 'a copied spec names the drink it is based on');
    await editOk(ids.venue2, { based_on_id: ids.classicB });
    const v = await row(ids.venue2);
    assert.deepEqual([v.riff_of_id, v.spec_source, v.spec_from_id], [ids.classicB, 'bar', null]);
  });
});

describe('one family', () => {
  test("an old build's Family row pick sets the family by name; a venue drink has no history family", async () => {
    await editOk(ids.venue, { family_id: ids.sour });
    const v = await row(ids.venue);
    assert.deepEqual([v.drink_family, v.lineage_family], ['Sour', null]);
  });

  test("a family outside the eight is a family too", async () => {
    await editOk(ids.venue, { family_id: ids.sipper });
    const v = await row(ids.venue);
    assert.deepEqual([v.drink_family, v.family_id], ['Sipper', ids.sipper]);
  });

  test('an old build clearing the Family row clears the family', async () => {
    await editOk(ids.venue, { family_id: null });
    assert.equal((await row(ids.venue)).drink_family, null);
  });

  test("a new build's family shows on old builds as the family item by that name, any case", async () => {
    await editOk(ids.venue, { drink_family: 'tiki' });
    const v = await row(ids.venue);
    assert.equal(v.drink_family, 'tiki', 'kept as written');
    assert.equal(v.family_id, ids.tiki, "the venue's own Tiki item");
  });

  test('an old build saving the family_id it loaded leaves a family a new build set', async () => {
    await editOk(ids.venue, { drink_family: `Low ABV ${run}` });
    const loaded = await row(ids.venue);
    assert.equal(loaded.family_id, null, 'no family item by that name');
    // An old build sends family_id on every save.
    await editOk(ids.venue, { name: loaded.name, family_id: loaded.family_id });
    assert.equal((await row(ids.venue)).drink_family, `Low ABV ${run}`);
  });

  test('a family name is trimmed and at most 40 characters', async () => {
    assert.ok((await edit(ids.venue, { drink_family: 'x'.repeat(41) })).error);
    assert.ok((await edit(ids.venue, { drink_family: ' Sour' })).error);
    assert.ok((await edit(ids.venue, { drink_family: '' })).error);
  });

  test("a catalog drink in the history tree keeps lineage_family in step with the family's key, both ways", async () => {
    await db.query("UPDATE public.items SET drink_family = 'Tiki' WHERE id = $1", [ids.child]);
    assert.equal((await row(ids.child)).lineage_family, 'tiki');
    await db.query("UPDATE public.items SET lineage_family = 'flip' WHERE id = $1", [ids.child]);
    assert.equal((await row(ids.child)).drink_family, 'Flip', "the key's name");
    await db.query("UPDATE public.items SET drink_family = 'Sours' WHERE id = $1", [ids.child]);
    assert.equal((await row(ids.child)).lineage_family, 'sour', 'Sours is the sour family');
    // A family outside the eight takes it out of old builds' tree; one of the eight puts it back.
    await db.query("UPDATE public.items SET drink_family = 'Sipper' WHERE id = $1", [ids.child]);
    assert.equal((await row(ids.child)).lineage_family, null);
    await db.query("UPDATE public.items SET drink_family = 'Sour' WHERE id = $1", [ids.child]);
    assert.equal((await row(ids.child)).lineage_family, 'sour', 'its history link keeps it in the tree');
    // Outside the tree (no history link, no tree family), a family doesn't add it to old builds' tree.
    await db.query("UPDATE public.items SET drink_family = 'Flip' WHERE id = $1", [ids.classicB]);
    const b = await row(ids.classicB);
    assert.deepEqual([b.drink_family, b.lineage_family], ['Flip', null]);
    if (b.family_id) assert.equal((await nameOf(b.family_id)).trim().toLowerCase(), 'flip', 'a shared Flip item, if there is one');
  });
});

describe('the guards watch the new columns too', () => {
  test('history stays catalog only, by either column', async () => {
    const old = await edit(ids.venue, { lineage_parent_id: ids.classicA });
    assert.match(old.error?.message ?? '', /Only catalog admins|catalog_only/);
    const fresh = await edit(ids.venue, { based_on_id: ids.classicA, based_on_kind: 'descends' });
    assert.match(fresh.error?.message ?? '', /Only catalog admins|catalog_only/);
    assert.equal((await row(ids.venue)).based_on_kind, 'riff', 'nothing changed');
  });

  test('only catalog admins change the family tree, by either column', async () => {
    // Run as the editor at the SQL level, past RLS (catalog drinks aren't theirs), to reach the trigger.
    await db.query('BEGIN');
    try {
      await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: users.editor.id, role: 'authenticated' })]);
      const tries = [
        ['UPDATE public.items SET lineage_parent_id = $2 WHERE id = $1', [ids.child, ids.classicB]],
        ['UPDATE public.items SET based_on_id = $2 WHERE id = $1', [ids.child, ids.classicB]],
        ["UPDATE public.items SET based_on_kind = 'riff' WHERE id = $1", [ids.child]],
        ['UPDATE public.items SET riff_of_id = $2 WHERE id = $1', [ids.child, ids.classicB]],
        ["UPDATE public.items SET drink_family = 'Flip' WHERE id = $1", [ids.child]],
        ['UPDATE public.items SET family_id = $2 WHERE id = $1', [ids.child, ids.tiki]],
      ];
      for (const [sql, params] of tries) {
        await db.query('SAVEPOINT try');
        await assert.rejects(db.query(sql, params), /Only catalog admins can change the family tree/, sql);
        await db.query('ROLLBACK TO SAVEPOINT try');
      }
    } finally {
      await db.query('ROLLBACK');
    }
    const child = await row(ids.child);
    assert.deepEqual([child.based_on_id, child.based_on_kind, child.drink_family], [ids.classicA, 'descends', 'Sour']);
  });

  test("only the catalog marks a spec as the classic's", async () => {
    await editOk(ids.venue, { based_on_id: ids.classicA });
    const { error } = await edit(ids.venue, { spec_source: 'classic', spec_from_id: ids.classicA });
    assert.match(error?.message ?? '', /Only the catalog can mark a spec/);
    const alone = await edit(ids.venue, { spec_from_id: ids.classicA });
    assert.match(alone.error?.message ?? '', /Only the catalog can mark a spec/);
    const v = await row(ids.venue);
    assert.deepEqual([v.spec_source, v.spec_from_id], ['bar', null]);
  });
});

describe('merges and deletes', () => {
  test('a merge moves based_on_id, and the old columns with it', async () => {
    await db.query('BEGIN');
    try {
      const ins = async (name, basedOn = null, riffOf = null) =>
        (
          await db.query("INSERT INTO public.items (name, item_type, based_on_id, riff_of_id) VALUES ($1, 'cocktail', $2, $3) RETURNING id", [
            `${name} ${run}`,
            basedOn,
            riffOf,
          ])
        ).rows[0].id;
      const keep = await ins('Lineage Merge Keep');
      const copy = await ins('Lineage Merge Copy');
      const newRiff = await ins('Lineage Merge New Riff', copy); // a new build's write
      const oldRiff = await ins('Lineage Merge Old Riff', null, copy); // an old build's
      await db.query("UPDATE public.items SET spec_source = 'classic', spec_from_id = $2 WHERE id = $1", [oldRiff, copy]);
      // The kept drink was itself a riff of the copy.
      await db.query('UPDATE public.items SET based_on_id = $2 WHERE id = $1', [keep, copy]);
      await db.query('SELECT private.merge_item($1, $2)', [copy, keep]);

      const a = await row(newRiff);
      assert.deepEqual([a.based_on_id, a.based_on_kind, a.riff_of_id], [keep, 'riff', keep]);
      const b = await row(oldRiff);
      assert.deepEqual([b.based_on_id, b.riff_of_id, b.spec_source, b.spec_from_id], [keep, keep, 'classic', keep], 'a copied spec follows the merge');
      const k = await row(keep);
      assert.deepEqual([k.based_on_id, k.riff_of_id], [null, null], 'not based on itself');
    } finally {
      await db.query('ROLLBACK');
    }
  });

  test('deleting the drink another is based on clears every link, old and new', async () => {
    await db.query('BEGIN');
    try {
      const classic = (await db.query("INSERT INTO public.items (name, item_type) VALUES ($1, 'cocktail') RETURNING id", [`Lineage Gone ${run}`])).rows[0].id;
      const filled = (await db.query("INSERT INTO public.items (name, item_type, riff_of_id) VALUES ($1, 'cocktail', $2) RETURNING id", [`Lineage Orphan ${run}`, classic])).rows[0].id;
      await db.query("UPDATE public.items SET spec_source = 'classic', spec_from_id = $2 WHERE id = $1", [filled, classic]);
      await db.query('DELETE FROM public.items WHERE id = $1', [classic]);
      const f = await row(filled);
      assert.deepEqual([f.based_on_id, f.based_on_kind, f.riff_of_id, f.spec_from_id, f.spec_source], [null, null, null, null, 'bar']);
    } finally {
      await db.query('ROLLBACK');
    }
  });
});
