// Faster drink reads, same visibility
// (supabase/migrations/20261008310000_presentation_rls_speed.sql).
//
// Loads the definitions that migration replaced (fixtures/presentation-before.sql,
// as temp views) and checks that every reader gets exactly the same rows from
// the old and new published_items, app_recipe_presentation and items policy,
// and from the tables that follow an item's visibility, over a set of drinks
// that covers each branch: venue drinks at every publish level and page
// visibility, menu-published drinks, credited drinks of claimed and unclaimed
// bars, classics, personal drinks (published, private, moderated, by a
// blocked maker) and the glass, ice, family, methods and ingredients they use.
// Everything happens in one transaction that is rolled back.
// Runs against the local stack only: `npm run test:security`.
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';

import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run presentation tests against a non-local API: ${status.API_URL}`);
}

const db = new pg.Client({ connectionString: status.DB_URL });
const run = randomUUID().slice(0, 8);
const id = {};
const uid = (key) => (id[key] ??= randomUUID());

const FOLLOWERS = ['item_images', 'item_categories', 'item_methods'];
const READERS = ['anon', 'admin', 'manager', 'bartender', 'expired', 'stranger', 'blocker', 'maker', 'catalogAdmin', 'viewAs'];

async function asReader(reader, fn) {
  await db.query('SAVEPOINT reader');
  try {
    const claims = reader === 'anon' ? { role: 'anon' } : { sub: uid(`user:${reader}`), role: 'authenticated' };
    await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    await db.query(`SET LOCAL ROLE ${reader === 'anon' ? 'anon' : 'authenticated'}`);
    return await fn();
  } finally {
    await db.query('ROLLBACK TO SAVEPOINT reader');
  }
}

const rows = async (sql, params = []) => (await db.query(sql, params)).rows.map((r) => Object.values(r)[0]).sort();

async function seed() {
  const users = ['admin', 'manager', 'bartender', 'expired', 'stranger', 'blocker', 'maker', 'catalogAdmin', 'viewAs', 'hidden'];
  for (const u of users) {
    await db.query(
      `INSERT INTO auth.users (id, instance_id, aud, role, email, email_confirmed_at, created_at, updated_at)
       VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, now(), now(), now())`,
      [uid(`user:${u}`), `${u}-${run}@security-test.local`]
    );
  }
  await db.query('INSERT INTO private.app_admins (user_id) VALUES ($1)', [uid('user:catalogAdmin')]);
  const bar = (key, page, mode, visibility = 10) =>
    db.query(
      `INSERT INTO public.bars (id, name, slug, page_visibility, default_publish_mode, default_visibility_level) VALUES ($1, $2, $3, $4, $5, $6)`,
      [uid(`bar:${key}`), `Speed ${key} ${run}`, `speed-${key}-${run}`, page, mode, visibility]
    );
  await bar('open', 'open', 'private');
  await bar('desc', 'description', 'spec');
  await bar('locked', 'locked', 'description', 20);
  await bar('hidden', 'open', 'spec');
  for (const key of ['open', 'desc', 'locked', 'hidden']) {
    await db.query(
      `INSERT INTO public.profiles (id, kind, handle, display_name, is_public, bar_id) VALUES ($1, 'bar', $2, $3, $4, $5)`,
      [uid(`profile:${key}`), `speed${key}${run}`, `Speed ${key} ${run}`, key !== 'hidden', uid(`bar:${key}`)]
    );
  }
  await db.query(
    `INSERT INTO public.profiles (id, kind, handle, display_name, is_public) VALUES ($1, 'bar', $2, $3, true)`,
    [uid('profile:unclaimed'), `speedunclaimed${run}`, `Speed unclaimed ${run}`]
  );
  for (const u of ['stranger', 'blocker', 'maker', 'hidden']) {
    await db.query(
      `INSERT INTO public.profiles (id, kind, handle, display_name, is_public, user_id) VALUES ($1, 'person', $2, $3, $4, $5)`,
      [uid(`person:${u}`), `speedp${u}${run}`, `Speed ${u} ${run}`, u !== 'hidden', uid(`user:${u}`)]
    );
  }
  await db.query(
    `INSERT INTO public.venue_roles (id, bar_id, name, base_level, ends_at) VALUES ($1, $2, 'Guest shift', 20, now() - interval '1 day')`,
    [uid('role:expired'), uid('bar:open')]
  );
  const member = (u, b, level, role = null) =>
    db.query('INSERT INTO public.user_bars (user_id, bar_id, role_level, venue_role_id) VALUES ($1, $2, $3, $4)', [uid(`user:${u}`), uid(`bar:${b}`), level, role]);
  await member('admin', 'open', 40);
  await member('admin', 'locked', 40);
  await member('manager', 'open', 35);
  await member('bartender', 'open', 10);
  await member('bartender', 'desc', 20);
  await member('expired', 'open', 20, uid('role:expired'));
  await member('viewAs', 'open', 40);
  await db.query('INSERT INTO public.user_prefs (user_id, view_as_role_level) VALUES ($1, 10)', [uid('user:viewAs')]);
  await db.query('INSERT INTO public.user_blocks (blocker_id, blocked_id) VALUES ($1, $2)', [uid('user:blocker'), uid('user:maker')]);

  const item = (key, cols) => {
    const row = { id: uid(`item:${key}`), name: `Speed ${key} ${run}`, created_by: null, ...cols };
    const names = Object.keys(row);
    return db.query(
      `INSERT INTO public.items (${names.join(', ')}) VALUES (${names.map((_, i) => `$${i + 1}`).join(', ')})`,
      Object.values(row)
    );
  };
  for (const kind of ['glassware', 'ice', 'family', 'method']) await item(kind, { item_type: kind });
  await item('glass2', { item_type: 'glassware' });
  await item('gin', { item_type: 'ingredient', abv: 40 });
  await item('citrus', { item_type: 'ingredient' });
  await item('vermouth', { item_type: 'ingredient', abv: 17 });
  await item('lemon', { item_type: 'ingredient', generic_id: uid('item:citrus') });
  await item('bottle', { item_type: 'ingredient', bar_id: uid('bar:open'), generic_id: uid('item:gin'), abv: 43 });
  const refs = { glassware_id: uid('item:glassware'), ice_id: uid('item:ice'), family_id: uid('item:family') };
  const drinks = {
    openSpec: { bar_id: uid('bar:open'), publish_mode: 'spec' },
    openDescription: { bar_id: uid('bar:open'), publish_mode: 'description' },
    openMenu: { bar_id: uid('bar:open') },
    openPrivate: { bar_id: uid('bar:open'), override_visibility_level: 30, override_measurement_level: 40 },
    openLowMeasure: { bar_id: uid('bar:open'), override_measurement_level: 10, override_specific_brand_level: 10 },
    openDefault: { bar_id: uid('bar:open') },
    descDefault: { bar_id: uid('bar:desc') },
    descSpec: { bar_id: uid('bar:desc'), publish_mode: 'spec' },
    lockedSpec: { bar_id: uid('bar:locked'), publish_mode: 'spec' },
    hiddenBarSpec: { bar_id: uid('bar:hidden'), publish_mode: 'spec' },
    creditedUnclaimed: { origin_bar_profile_id: uid('profile:unclaimed') },
    creditedOpen: { origin_bar_profile_id: uid('profile:open') },
    creditedDesc: { origin_bar_profile_id: uid('profile:desc'), publish_mode: 'spec' },
    classic: { is_catalog: true },
    shared: {},
    personalSpec: { created_by: uid('user:maker'), publish_mode: 'spec' },
    personalDescription: { created_by: uid('user:maker'), publish_mode: 'description' },
    personalPrivate: { created_by: uid('user:maker') },
    personalModerated: { created_by: uid('user:maker'), publish_mode: 'spec', moderated_at: new Date() },
    personalHiddenProfile: { created_by: uid('user:hidden'), publish_mode: 'spec' },
    strangerOwn: { created_by: uid('user:stranger') },
  };
  for (const [key, cols] of Object.entries(drinks)) {
    drinkKeys.push(key);
    await item(key, { item_type: 'cocktail', description: `${key} notes`, ...refs, ...(key === 'shared' ? { glassware_id: uid('item:glass2') } : {}), ...cols });
    const lines = [
      [uid('item:gin'), null, 'shake'],
      [uid('item:lemon'), uid('item:citrus'), null],
      [uid('item:bottle'), null, null],
      // Only in drinks published as a description: never a reference row.
      ...(cols.publish_mode === 'description' ? [[uid('item:vermouth'), null, null]] : []),
    ];
    for (const [i, [ingredient, parent, prep]] of lines.entries()) {
      await db.query(
        `INSERT INTO public.recipes (recipe_item_id, ingredient_item_id, parent_ingredient_id, amount, unit, sort_order, preparation_notes)
         VALUES ($1, $2, $3, $4, 'ml', $5, $6)`,
        [uid(`item:${key}`), ingredient, parent, 30 - i * 10, i, prep]
      );
    }
    await db.query('INSERT INTO public.item_methods (item_id, method_item_id, sort_order) VALUES ($1, $2, 0)', [uid(`item:${key}`), uid('item:method')]);
    await db.query(`INSERT INTO public.images (id, url) VALUES ($1, $2)`, [uid(`image:${key}`), `https://example.test/${run}/${key}.jpg`]);
    await db.query(`INSERT INTO public.item_images (item_id, image_id, angle, sort_order) VALUES ($1, $2, 'hero', 0)`, [uid(`item:${key}`), uid(`image:${key}`)]);
  }
  await db.query(`INSERT INTO public.categories (id, name) VALUES ($1, $2)`, [uid('category'), `Speed ${run}`]);
  for (const key of ['openPrivate', 'openSpec', 'personalPrivate', 'gin']) {
    await db.query('INSERT INTO public.item_categories (item_id, category_id) VALUES ($1, $2)', [uid(`item:${key}`), uid('category')]);
  }
  // A menu with a publish level publishes its drinks that have none of their own.
  await db.query(`INSERT INTO public.menus (id, name, bar_id, publish_mode) VALUES ($1, $2, $3, 'spec')`, [uid('menu'), `Speed ${run}`, uid('bar:open')]);
  await db.query('INSERT INTO public.menu_drinks (menu_id, item_id) VALUES ($1, $2)', [uid('menu'), uid('item:openMenu')]);
}

const itemIds = () => Object.entries(id).filter(([k]) => k.startsWith('item:')).map(([, v]) => v);
const drinkKeys = [];
const drinkIds = () => drinkKeys.map((key) => uid(`item:${key}`));

before(async () => {
  await db.connect();
  await db.query('BEGIN');
  // Fixtures go straight in: this file checks reads, not the write guards.
  await db.query('SET LOCAL session_replication_role = replica');
  await seed();
  await db.query('SET LOCAL session_replication_role = origin');
  await db.query(readFileSync(new URL('./fixtures/presentation-before.sql', import.meta.url), 'utf8'));
});

after(async () => {
  await db.query('ROLLBACK').catch(() => {});
  await db.end();
});

describe('old and new definitions agree for every reader', () => {
  for (const reader of READERS) {
    test(`${reader}: published_items`, async () => {
      const ids = itemIds();
      const cols = 'id, name, item_type, description, bar_id, glassware_id, ice_id, family_id, origin, abv, icon_key, icon_url, publish_mode, published_at, riff_of_id, creator_profile_id, origin_bar_profile_id, origin_year, credit_status, is_reference, image_url, image_is_generated';
      await asReader(reader, async () => {
        const before = await rows(`SELECT row(${cols})::text FROM old_published_items WHERE id = ANY($1)`, [ids]);
        const now = await rows(`SELECT row(${cols})::text FROM public.published_items WHERE id = ANY($1)`, [ids]);
        assert.deepEqual(now, before);
        assert.ok(before.length > 0, 'the fixtures publish something');
        // One id at a time (the way the app asks) gives the same rows.
        const one = [];
        for (const itemId of ids) one.push(...(await rows(`SELECT row(${cols})::text FROM public.published_items WHERE id = $1`, [itemId])));
        assert.deepEqual(one.sort(), before);
      });
    });

    test(`${reader}: app_recipe_presentation`, async () => {
      await asReader(reader, async () => {
        const sql = (view) => `SELECT t::text FROM ${view} t WHERE t.recipe_item_id = ANY($1)`;
        const before = await rows(sql('old_app_recipe_presentation'), [drinkIds()]);
        assert.deepEqual(await rows(sql('public.app_recipe_presentation'), [drinkIds()]), before);
      });
    });

    if (reader === 'anon') continue;

    test(`${reader}: items and the tables that follow an item`, async () => {
      const ids = itemIds();
      // Every row, read as the owner (no RLS).
      const all = {};
      for (const table of FOLLOWERS) {
        all[table] = (await db.query(`SELECT item_id::text, t::text AS row FROM public.${table} t WHERE item_id = ANY($1)`, [ids])).rows;
      }
      await asReader(reader, async () => {
        const visible = await rows('SELECT id::text FROM old_visible_items WHERE id = ANY($1)', [ids]);
        assert.deepEqual(await rows('SELECT id::text FROM public.items WHERE id = ANY($1)', [ids]), visible);
        const locked = await rows('SELECT i::text FROM unnest($1::uuid[]) i WHERE public.is_spec_locked(i)', [ids]);
        for (const table of FOLLOWERS) {
          // The old policies: the row's item is visible (and, for methods, its spec isn't locked).
          const expected = all[table]
            .filter((r) => visible.includes(r.item_id) && !(table === 'item_methods' && locked.includes(r.item_id)))
            .map((r) => r.row)
            .sort();
          assert.deepEqual(await rows(`SELECT t::text FROM public.${table} t WHERE item_id = ANY($1)`, [ids]), expected, table);
        }
      });
    });
  }
});

describe('the fixtures cover the branches', () => {
  test('a bartender sees the venue drink they may, not the one above their level', async () => {
    await asReader('bartender', async () => {
      const seen = await rows('SELECT id::text FROM public.items WHERE id = ANY($1)', [[uid('item:openSpec'), uid('item:openPrivate')]]);
      assert.deepEqual(seen, [uid('item:openSpec')]);
    });
  });

  test('a Manager sees every drink of their venue', async () => {
    await asReader('manager', async () => {
      const seen = await rows('SELECT id::text FROM public.items WHERE id = ANY($1)', [[uid('item:openSpec'), uid('item:openPrivate')]]);
      assert.equal(seen.length, 2);
    });
  });

  test('an expired role sees no venue drinks', async () => {
    await asReader('expired', async () => {
      assert.deepEqual(await rows('SELECT id::text FROM public.items WHERE bar_id = $1', [uid('bar:open')]), []);
    });
  });

  test('a stranger reads a published spec, with generic ingredients, and its reference rows', async () => {
    await asReader('stranger', async () => {
      const spec = await db.query('SELECT display_ingredient_id::text, amount FROM public.app_recipe_presentation WHERE recipe_item_id = $1 ORDER BY sort_order', [uid('item:openSpec')]);
      assert.deepEqual(spec.rows.map((r) => r.display_ingredient_id), [uid('item:gin'), uid('item:citrus'), uid('item:gin')]);
      const refs = await rows('SELECT id::text FROM public.published_items WHERE is_reference AND id = ANY($1)', [itemIds()]);
      for (const key of ['glassware', 'ice', 'family', 'method', 'gin', 'citrus']) assert.ok(refs.includes(uid(`item:${key}`)), key);
      assert.ok(!refs.includes(uid('item:lemon')), 'a line with a parent shows the parent');
      assert.ok(!refs.includes(uid('item:vermouth')), 'a description-level drink shows no spec');
      assert.ok(!refs.includes(uid('item:glass2')), 'an unpublished drink makes no reference rows');
    });
  });

  test('view-as caps an Admin to the level they chose', async () => {
    await asReader('viewAs', async () => {
      const spec = await db.query('SELECT amount, preparation_notes FROM public.app_recipe_presentation WHERE recipe_item_id = $1 ORDER BY sort_order', [uid('item:openDefault')]);
      assert.deepEqual(spec.rows.map((r) => r.amount), [null, null, null]);
    });
  });
});
