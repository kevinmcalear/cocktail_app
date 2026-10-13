// Supplier pages (20261017530000_supplier_kind.sql, 20261017530100_suppliers.sql):
// a supplier's page is owned by a venue team like a maker's and claimed the
// same way, never holds an address, says what it supplies from a known list;
// supplier_lines say whose brands it carries where, readable signed out,
// written by the supplier's team and removable by the maker's; a venue's own
// supplier can point at a supplier's page and nothing else.
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
  throw new Error(`Refusing to run supplier tests against a non-local API: ${status.API_URL}`);
}

const run = randomUUID().slice(0, 8);
const PASSWORD = `pw-${randomUUID()}`;
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(status.API_URL, status.SERVICE_ROLE_KEY, clientOptions);
const anon = createClient(status.API_URL, status.ANON_KEY, clientOptions);
const db = new pg.Client({ connectionString: status.DB_URL });

const users = {};
const pages = {};
const ids = {};

async function makeUser(label) {
  const email = `${label}-${run}@security-test.local`;
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  const client = createClient(status.API_URL, status.ANON_KEY, clientOptions);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, client };
}

async function page(key, fields) {
  const { data, error } = await service
    .from('profiles')
    .insert({ handle: `${key}${run}`.toLowerCase(), display_name: `${key} ${run}`, is_public: true, ...fields })
    .select('id')
    .single();
  if (error) throw new Error(`fixture page failed: ${error.message}`);
  pages[key] = data.id;
  return data.id;
}

before(async () => {
  await db.connect();
  for (const label of ['publisher', 'makerteam', 'stranger', 'claimer', 'buyer']) users[label] = await makeUser(label);

  // Three venue teams: a supplier's, a maker's, and a bar that buys from them.
  for (const key of ['supplierTeam', 'makerTeam', 'buyerBar']) {
    ids[key] = (await db.query('INSERT INTO public.bars (name) VALUES ($1) RETURNING id', [`${key} ${run}`])).rows[0].id;
  }
  await db.query('INSERT INTO public.user_bars (bar_id, user_id, role_level) VALUES ($1, $2, 40), ($3, $4, 40), ($5, $6, 40)', [
    ids.supplierTeam, users.publisher.id, ids.makerTeam, users.makerteam.id, ids.buyerBar, users.buyer.id,
  ]);

  await page('Stillhouse', { kind: 'maker', makes: ['bottles'], bar_id: ids.makerTeam });
  await page('Other', { kind: 'maker', makes: ['bottles'] });
  await page('Pub', { kind: 'bar' });
  await page('Wholesale', { kind: 'supplier', supplies: ['bottles'], website: `https://wholesale${run}.example.com` });
});

after(async () => {
  const claimed = (await db.query('SELECT bar_id FROM public.profiles WHERE id = ANY($1) AND bar_id IS NOT NULL', [Object.values(pages)])).rows.map((r) => r.bar_id);
  await db.query('DELETE FROM public.profile_claims WHERE profile_id = ANY($1)', [Object.values(pages)]);
  await db.query('DELETE FROM public.profiles WHERE id = ANY($1)', [Object.values(pages)]);
  await db.query('DELETE FROM public.bars WHERE id = ANY($1)', [[ids.supplierTeam, ids.makerTeam, ids.buyerBar, ...claimed]]);
  for (const u of Object.values(users)) await service.auth.admin.deleteUser(u.id);
  await db.end();
});

describe('supplier pages', () => {
  test("a venue's publisher makes and edits its supplier page; nobody else can", async () => {
    const mine = await users.publisher.client
      .from('profiles')
      .insert({ kind: 'supplier', handle: `supply${run}`, display_name: `Supply Co ${run}`, bar_id: ids.supplierTeam, supplies: ['bottles', 'glassware'] })
      .select('id, is_public')
      .single();
    assert.equal(mine.error, null);
    assert.equal(mine.data.is_public, true, 'a supplier page is public by default, like a maker');
    pages.Supply = mine.data.id;
    const theirs = await users.stranger.client.from('profiles').update({ bio: 'mine now' }).eq('id', pages.Supply).select('id');
    assert.equal(theirs.data?.length ?? 0, 0);
    const forOther = await users.stranger.client.from('profiles').insert({ kind: 'supplier', handle: `fake${run}`, display_name: 'Fake', bar_id: ids.supplierTeam });
    assert.ok(forOther.error, "a stranger can't make a page for someone else's team");
  });

  test('a supplier page is owned by a team, never a person, and never has an address', async () => {
    await assert.rejects(
      db.query(`INSERT INTO public.profiles (kind, handle, display_name, user_id) VALUES ('supplier', $1, 'Solo', $2)`, [`solo${run}`, users.stranger.id]),
      /profiles_owner_matches_kind/
    );
    await assert.rejects(db.query('UPDATE public.profiles SET latitude = 10, longitude = 20 WHERE id = $1', [pages.Wholesale]), /profiles_person_has_no_address/);
  });

  test('only suppliers say what they supply, from the known list; suppliers make nothing', async () => {
    await assert.rejects(db.query(`UPDATE public.profiles SET supplies = '{bottles}' WHERE id = $1`, [pages.Stillhouse]), /profiles_supplies_known/);
    await assert.rejects(db.query(`UPDATE public.profiles SET supplies = '{napkins}' WHERE id = $1`, [pages.Wholesale]), /profiles_supplies_known/);
    await assert.rejects(db.query(`UPDATE public.profiles SET makes = '{bottles}' WHERE id = $1`, [pages.Wholesale]), /profiles_makes_known/);
  });

  test('a supplier lists the cities it delivers to, and signed-out visitors see it', async () => {
    const ok = await users.publisher.client
      .from('profiles')
      .update({ serves: ['Melbourne', 'Geelong'], supplies: ['bottles', 'ice'] })
      .eq('id', pages.Supply)
      .select('serves')
      .single();
    assert.equal(ok.error, null);
    const { data, error } = await anon.from('profiles').select('supplies, serves').eq('id', pages.Supply).single();
    assert.equal(error, null);
    assert.deepEqual(data, { supplies: ['bottles', 'ice'], serves: ['Melbourne', 'Geelong'] });
  });
});

describe('supplier lines', () => {
  test("the supplier's team says whose brands it carries where; anyone reads it", async () => {
    const line = await users.publisher.client
      .from('supplier_lines')
      .insert({ supplier_profile_id: pages.Supply, maker_profile_id: pages.Stillhouse, region: 'AU-VIC', source_url: 'https://example.com/brands' })
      .select('id')
      .single();
    assert.equal(line.error, null);
    ids.line = line.data.id;
    const { data } = await anon.from('supplier_lines').select('region, maker_profile_id').eq('supplier_profile_id', pages.Supply);
    assert.deepEqual(data, [{ region: 'AU-VIC', maker_profile_id: pages.Stillhouse }]);
    const again = await users.publisher.client.from('supplier_lines').insert({ supplier_profile_id: pages.Supply, maker_profile_id: pages.Stillhouse, region: 'AU-VIC' });
    assert.ok(again.error, 'one line per maker and region');
  });

  test("nobody else writes a supplier's lines", async () => {
    const stranger = await users.stranger.client.from('supplier_lines').insert({ supplier_profile_id: pages.Supply, maker_profile_id: pages.Other, region: 'AU' });
    assert.ok(stranger.error);
    const maker = await users.makerteam.client.from('supplier_lines').insert({ supplier_profile_id: pages.Supply, maker_profile_id: pages.Other, region: 'AU' });
    assert.ok(maker.error, "a maker's team can't put lines on a supplier's page");
    const edit = await users.stranger.client.from('supplier_lines').delete().eq('id', ids.line).select('id');
    assert.equal(edit.data?.length ?? 0, 0);
  });

  test('a line links a supplier to a maker, in a real region shape', async () => {
    await assert.rejects(
      db.query(`INSERT INTO public.supplier_lines (supplier_profile_id, maker_profile_id, region) VALUES ($1, $2, 'AU')`, [pages.Supply, pages.Pub]),
      /maker's page/
    );
    await assert.rejects(
      db.query(`INSERT INTO public.supplier_lines (supplier_profile_id, maker_profile_id, region) VALUES ($1, $2, 'AU')`, [pages.Stillhouse, pages.Other]),
      /supplier's page/
    );
    await assert.rejects(
      db.query(`INSERT INTO public.supplier_lines (supplier_profile_id, maker_profile_id, region) VALUES ($1, $2, 'Victoria')`, [pages.Supply, pages.Other]),
      /supplier_lines_region_check/
    );
    await assert.rejects(
      db.query(`INSERT INTO public.supplier_lines (supplier_profile_id, maker_profile_id, region, source_url) VALUES ($1, $2, 'AU', 'not a url')`, [pages.Supply, pages.Other]),
      /supplier_lines_source_url_check/
    );
  });

  test("the maker's team can take a line off its page", async () => {
    const gone = await users.makerteam.client.from('supplier_lines').delete().eq('id', ids.line).select('id');
    assert.equal(gone.data?.length, 1);
  });
});

describe("a venue's own supplier", () => {
  test("points at a supplier's page and nothing else", async () => {
    const own = await users.buyer.client
      .from('suppliers')
      .insert({ bar_id: ids.buyerBar, name: `Our rep ${run}`, profile_id: pages.Supply })
      .select('id, profile_id')
      .single();
    assert.equal(own.error, null);
    assert.equal(own.data.profile_id, pages.Supply);
    const wrong = await users.buyer.client.from('suppliers').update({ profile_id: pages.Stillhouse }).eq('id', own.data.id).select('id');
    assert.ok(wrong.error, "a maker's page isn't a supplier");
    const peek = await users.publisher.client.from('suppliers').select('id').eq('id', own.data.id);
    assert.equal(peek.data?.length ?? 0, 0, "the supplier can't read a venue's own supplier list");
  });
});

describe('claiming a supplier page', () => {
  test("a supplier's page is claimed like a maker's, in its own words", async () => {
    const { error } = await users.claimer.client.rpc('start_bar_claim', { p_profile_id: pages.Wholesale, p_method: 'email' });
    assert.match(error?.message ?? '', /this supplier's website domain/);
    const { data, error: phoneError } = await users.claimer.client.rpc('start_bar_claim', { p_profile_id: pages.Wholesale, p_method: 'phone' });
    assert.equal(phoneError, null);
    assert.equal(data.status, 'pending');
  });
});
