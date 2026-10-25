// One page for RCR Cristalleria Italiana (20261117400000_rcr_one_page.sql):
// `rcr` keeps every supplier's line and takes the company's full name, city
// and barware; the old handle is gone and its links go to /p/rcr.
//
//   supabase start && supabase db reset
//   npm run test:security

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { after, before, describe, test } from 'node:test';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const status = JSON.parse(
  execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
);
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) {
  throw new Error(`Refusing to run RCR page tests against a non-local API: ${status.API_URL}`);
}

const anon = createClient(status.API_URL, status.ANON_KEY, { auth: { persistSession: false } });
const db = new pg.Client({ connectionString: status.DB_URL });
before(() => db.connect());
after(() => db.end());

describe('one RCR page', () => {
  test('rcr has the full name, the city, both kinds and every line', async () => {
    const { rows } = await db.query(
      `SELECT p.handle, p.display_name, p.city, p.makes,
              (SELECT array_agg(s.handle ORDER BY s.handle) FROM public.supplier_lines l JOIN public.profiles s ON s.id = l.supplier_profile_id
                WHERE l.maker_profile_id = p.id) AS suppliers
         FROM public.profiles p WHERE p.handle LIKE 'rcr%'`
    );
    assert.equal(rows.length, 1);
    const [rcr] = rows;
    assert.equal(rcr.handle, 'rcr');
    assert.equal(rcr.display_name, 'RCR Cristalleria Italiana');
    assert.equal(rcr.city, "Colle di Val d'Elsa");
    assert.deepEqual(rcr.makes, ['barware', 'glassware']);
    assert.deepEqual(rcr.suppliers, ['adelaide.hospitality.warehouse', 'chef.s.hat', 'lumas.hospitality', 'reward.hospitality', 'unicorn.kitchenware']);
  });

  test('the old handle goes to rcr', async () => {
    const { data, error } = await anon.rpc('merged_profile_handle', { p_ref: 'rcr.cristalleria.italiana' });
    assert.ifError(error);
    assert.equal(data, 'rcr');
  });
});
