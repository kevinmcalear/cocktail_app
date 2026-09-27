// Menus own their sections and carry their dates
// (migration 20260927100000_menu_sections_and_dates). Runs through the real
// API as real users.
//
//   supabase start && supabase db reset
//   npm run test:security
//
// Every fixture is named with a per-run id and removed afterwards.

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
  throw new Error(`Refusing to run menu tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const ids = {};
const day = 24 * 60 * 60 * 1000;

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
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

async function menuRow(id) {
  const { rows } = await db.query('SELECT is_active, starts_at, ends_at FROM public.menus WHERE id = $1', [id]);
  return rows[0];
}

async function newMenu(name, extra = {}) {
  return (await serviceInsert('menus', { name: `${name} ${run}`, bar_id: ids.bar, ...extra })).id;
}

before(async () => {
  await db.connect();
  for (const label of ['maker', 'floor', 'outsider']) users[label] = await makeUser(label);

  ids.bar = (await serviceInsert('bars', { name: `Little Rye ${run}` })).id;
  ids.otherBar = (await serviceInsert('bars', { name: `Pale Moth ${run}` })).id;
  await serviceInsert('user_bars', { user_id: users.maker.id, bar_id: ids.bar, role_level: 35 });
  await serviceInsert('user_bars', { user_id: users.floor.id, bar_id: ids.bar, role_level: 20 });
  await serviceInsert('user_bars', { user_id: users.outsider.id, bar_id: ids.otherBar, role_level: 40 });

  ids.martini = (await serviceInsert('items', { name: `House Martini ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  ids.boloTie = (await serviceInsert('items', { name: `Bolo Tie ${run}`, item_type: 'cocktail', bar_id: ids.bar })).id;
  ids.pilsner = (await serviceInsert('items', { name: `Pilsner ${run}`, item_type: 'beer', bar_id: ids.bar })).id;

  ids.template = (await serviceInsert('menu_templates', { name: `Classic ${run}` })).id;
  ids.stirredTemplateSection = (
    await serviceInsert('template_sections', { template_id: ids.template, name: 'Stirred', sort_order: 0, allowed_types: ['cocktail'] })
  ).id;
});

after(async () => {
  const like = `%${run}%`;
  await db.query('DELETE FROM public.menus WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.menu_templates WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.items WHERE name LIKE $1', [like]);
  await db.query('DELETE FROM public.bars WHERE name LIKE $1', [like]);
  for (const user of Object.values(users)) await service.auth.admin.deleteUser(user.id);
  await db.end();
});

describe('menu sections', () => {
  test('a maker saves the whole layout in order, and staff can read it', async () => {
    const menu = await newMenu('Winter');
    const { error } = await users.maker.client.rpc('save_menu', {
      p_menu_id: menu,
      p_name: `Winter menu ${run}`,
      p_cover_url: null,
      p_cover_position: 40,
      p_sections: [
        { name: 'Stirred', min_items: 2, max_items: 5, allowed_types: ['cocktail'], item_ids: [ids.boloTie, ids.martini] },
        { name: 'Beer', allowed_types: ['beer'], item_ids: [ids.pilsner] },
      ],
    });
    assert.ifError(error);

    const { data: sections, error: readError } = await users.floor.client
      .from('menu_sections')
      .select('name, sort_order, min_items, max_items, allowed_types, menu_drinks(item_id, sort_order)')
      .eq('menu_id', menu)
      .order('sort_order');
    assert.ifError(readError);
    assert.deepEqual(sections.map((s) => s.name), ['Stirred', 'Beer']);
    assert.equal(sections[0].max_items, 5);
    const stirred = [...sections[0].menu_drinks].sort((a, b) => a.sort_order - b.sort_order).map((d) => d.item_id);
    assert.deepEqual(stirred, [ids.boloTie, ids.martini]);
  });

  test('saving again keeps named sections, removes dropped ones, and replaces the drinks', async () => {
    const menu = await newMenu('Resave');
    await users.maker.client.rpc('save_menu', {
      p_menu_id: menu, p_name: `Resave ${run}`, p_cover_url: null, p_cover_position: null,
      p_sections: [
        { name: 'Stirred', allowed_types: ['cocktail'], item_ids: [ids.martini] },
        { name: 'Beer', allowed_types: ['beer'], item_ids: [ids.pilsner] },
      ],
    });
    const { rows: first } = await db.query('SELECT id, name FROM public.menu_sections WHERE menu_id = $1 ORDER BY sort_order', [menu]);

    const { error } = await users.maker.client.rpc('save_menu', {
      p_menu_id: menu, p_name: `Resave ${run}`, p_cover_url: null, p_cover_position: null,
      p_sections: [{ id: first[0].id, name: 'Stirred & strong', allowed_types: ['cocktail'], item_ids: [ids.boloTie] }],
    });
    assert.ifError(error);
    const { rows: after } = await db.query(
      'SELECT s.id, s.name, array_agg(d.item_id) AS items FROM public.menu_sections s LEFT JOIN public.menu_drinks d ON d.menu_section_id = s.id WHERE s.menu_id = $1 GROUP BY s.id',
      [menu]
    );
    assert.equal(after.length, 1);
    assert.equal(after[0].id, first[0].id);
    assert.equal(after[0].name, 'Stirred & strong');
    assert.deepEqual(after[0].items, [ids.boloTie]);
  });

  test('a drink of a type the section does not take is refused, and nothing changes', async () => {
    const menu = await newMenu('Types');
    await users.maker.client.rpc('save_menu', {
      p_menu_id: menu, p_name: `Types ${run}`, p_cover_url: null, p_cover_position: null,
      p_sections: [{ name: 'Stirred', allowed_types: ['cocktail'], item_ids: [ids.martini] }],
    });
    const { error } = await users.maker.client.rpc('save_menu', {
      p_menu_id: menu, p_name: `Types ${run}`, p_cover_url: null, p_cover_position: null,
      p_sections: [{ name: 'Stirred', allowed_types: ['cocktail'], item_ids: [ids.pilsner] }],
    });
    assert.ok(error, 'expected the beer to be refused');
    const { rows } = await db.query('SELECT item_id FROM public.menu_drinks WHERE menu_id = $1', [menu]);
    assert.deepEqual(rows.map((r) => r.item_id), [ids.martini]);
  });

  test('staff below Drink Creator and other venues cannot write sections', async () => {
    const menu = await newMenu('Locked');
    for (const who of ['floor', 'outsider']) {
      const { error } = await users[who].client.rpc('save_menu', {
        p_menu_id: menu, p_name: 'Taken', p_cover_url: null, p_cover_position: null, p_sections: [],
      });
      assert.ok(error, `${who} should not save`);
      const { error: insertError } = await users[who].client
        .from('menu_sections')
        .insert({ menu_id: menu, name: 'Sneaky' });
      assert.ok(insertError, `${who} should not insert a section`);
    }
    const { rows } = await db.query('SELECT name FROM public.menus WHERE id = $1', [menu]);
    assert.equal(rows[0].name, `Locked ${run}`);
  });

  test('another venue cannot read the sections', async () => {
    const menu = await newMenu('Private');
    await serviceInsert('menu_sections', { menu_id: menu, name: 'Stirred' });
    const { data, error } = await users.outsider.client.from('menu_sections').select('id').eq('menu_id', menu);
    assert.ifError(error);
    assert.equal(data.length, 0);
  });

  test('a legacy insert naming a template section lands in the menu’s own copy of it', async () => {
    const menu = await newMenu('Legacy', { template_id: ids.template });
    const { error } = await users.maker.client
      .from('menu_drinks')
      .insert([
        { menu_id: menu, template_section_id: ids.stirredTemplateSection, item_id: ids.martini, sort_order: 0 },
        { menu_id: menu, template_section_id: ids.stirredTemplateSection, item_id: ids.boloTie, sort_order: 1 },
      ]);
    assert.ifError(error);
    const { rows } = await db.query(
      'SELECT s.name, s.allowed_types, count(d.id)::int AS drinks FROM public.menu_sections s JOIN public.menu_drinks d ON d.menu_section_id = s.id WHERE s.menu_id = $1 GROUP BY s.id',
      [menu]
    );
    assert.deepEqual(rows, [{ name: 'Stirred', allowed_types: ['cocktail'], drinks: 2 }]);
  });
});

test('a legacy insert with no section at all lands in the menu’s first section', async () => {
  const menu = await newMenu('No section');
  const { error } = await users.maker.client.from('menu_drinks').insert({ menu_id: menu, item_id: ids.martini, sort_order: 0 });
  assert.ifError(error);
  const { error: secondError } = await users.maker.client.from('menu_drinks').insert({ menu_id: menu, item_id: ids.boloTie, sort_order: 1 });
  assert.ifError(secondError);
  const { rows } = await db.query(
    'SELECT s.name, count(d.id)::int AS drinks FROM public.menu_sections s JOIN public.menu_drinks d ON d.menu_section_id = s.id WHERE s.menu_id = $1 GROUP BY s.id',
    [menu]
  );
  assert.deepEqual(rows, [{ name: 'Drinks', drinks: 2 }]);
});

describe('menu dates', () => {
  test('a new menu is a draft; a legacy "current" insert starts now', async () => {
    const draft = await newMenu('Draft');
    assert.deepEqual(await menuRow(draft), { is_active: false, starts_at: null, ends_at: null });

    const current = await newMenu('Current', { is_active: true });
    const row = await menuRow(current);
    assert.equal(row.is_active, true);
    assert.ok(row.starts_at && Math.abs(row.starts_at - Date.now()) < 60_000);
  });

  test('the legacy toggle moves the dates', async () => {
    const menu = await newMenu('Toggle', { is_active: true });
    const { error } = await users.maker.client.from('menus').update({ is_active: false }).eq('id', menu);
    assert.ifError(error);
    const off = await menuRow(menu);
    assert.equal(off.is_active, false);
    assert.ok(off.starts_at && off.ends_at && off.ends_at >= off.starts_at);

    await users.maker.client.from('menus').update({ is_active: true }).eq('id', menu);
    const on = await menuRow(menu);
    assert.equal(on.is_active, true);
    assert.equal(on.ends_at, null);
  });

  test('scheduling a menu replaces the current one at its start, and the sweep turns it on', async () => {
    const autumn = await newMenu('Autumn', { is_active: true });
    const winter = await newMenu('Winter start');
    const start = new Date(Date.now() + 3 * day);

    const { error } = await users.maker.client.rpc('schedule_menu', {
      p_menu_id: winter, p_starts_at: start.toISOString(), p_replace_menu_ids: [autumn],
    });
    assert.ifError(error);
    const w = await menuRow(winter);
    const a = await menuRow(autumn);
    assert.equal(w.is_active, false, 'coming up, not on yet');
    assert.equal(w.starts_at.getTime(), start.getTime());
    assert.equal(a.is_active, true, 'autumn stays on until then');
    assert.equal(a.ends_at.getTime(), start.getTime());

    // Time passes (dates moved back without the trigger), then the sweep runs.
    await db.query('ALTER TABLE public.menus DISABLE TRIGGER menus_sync_active');
    await db.query(
      "UPDATE public.menus SET starts_at = starts_at - interval '4 days', ends_at = now() - interval '1 day' WHERE id = $1",
      [autumn]
    );
    await db.query("UPDATE public.menus SET starts_at = now() - interval '1 day' WHERE id = $1", [winter]);
    await db.query('ALTER TABLE public.menus ENABLE TRIGGER menus_sync_active');
    assert.equal((await menuRow(winter)).is_active, false, 'not flipped until the sweep');
    await db.query('SELECT private.sweep_menu_dates()');
    assert.equal((await menuRow(winter)).is_active, true);
    assert.equal((await menuRow(autumn)).is_active, false);
  });

  test('a rename between a scheduled start and the sweep does not end the menu', async () => {
    const menu = await newMenu('Due');
    await db.query(
      "UPDATE public.menus SET starts_at = now() + interval '1 day' WHERE id = $1", [menu]
    );
    // The start passes but the sweep hasn't run: is_active is still false.
    await db.query("ALTER TABLE public.menus DISABLE TRIGGER menus_sync_active");
    await db.query("UPDATE public.menus SET starts_at = now() - interval '1 minute' WHERE id = $1", [menu]);
    await db.query("ALTER TABLE public.menus ENABLE TRIGGER menus_sync_active");
    assert.equal((await menuRow(menu)).is_active, false);

    const { error } = await users.maker.client.from('menus').update({ name: `Due renamed ${run}` }).eq('id', menu);
    assert.ifError(error);
    const row = await menuRow(menu);
    assert.equal(row.ends_at, null);
    assert.equal(row.is_active, true);
  });

  test('a menu with a short section cannot go on', async () => {
    const menu = await newMenu('Short');
    await users.maker.client.rpc('save_menu', {
      p_menu_id: menu, p_name: `Short ${run}`, p_cover_url: null, p_cover_position: null,
      p_sections: [{ name: 'Stirred', min_items: 2, allowed_types: ['cocktail'], item_ids: [ids.martini] }],
    });
    const { error } = await users.maker.client.rpc('schedule_menu', { p_menu_id: menu });
    assert.ok(error);
    assert.match(error.message, /Stirred/);
    assert.equal((await menuRow(menu)).starts_at, null);
  });

  test('only the venue’s editors can put a menu on or take it off, and only its own menus are replaced', async () => {
    const menu = await newMenu('Gate');
    const foreign = (await serviceInsert('menus', { name: `Foreign ${run}`, bar_id: ids.otherBar, is_active: true })).id;
    const { error: floorError } = await users.floor.client.rpc('schedule_menu', { p_menu_id: menu });
    assert.ok(floorError);
    const { error: endError } = await users.floor.client.rpc('end_menu', { p_menu_id: foreign });
    assert.ok(endError);
    const { error: replaceError } = await users.maker.client.rpc('schedule_menu', {
      p_menu_id: menu, p_replace_menu_ids: [foreign],
    });
    assert.ok(replaceError);
    assert.equal((await menuRow(foreign)).is_active, true);
    assert.equal((await menuRow(menu)).starts_at, null);
  });

  test('taking a menu off ends it now; a scheduled one goes back to draft', async () => {
    const live = await newMenu('Live', { is_active: true });
    const soon = await newMenu('Soon');
    await users.maker.client.rpc('schedule_menu', { p_menu_id: soon, p_starts_at: new Date(Date.now() + day).toISOString() });

    for (const id of [live, soon]) {
      const { error } = await users.maker.client.rpc('end_menu', { p_menu_id: id });
      assert.ifError(error);
    }
    const l = await menuRow(live);
    assert.equal(l.is_active, false);
    assert.ok(l.ends_at);
    assert.deepEqual(await menuRow(soon), { is_active: false, starts_at: null, ends_at: null });
  });
});
