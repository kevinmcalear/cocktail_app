import { test } from 'node:test';
import assert from 'node:assert/strict';

import { assertReadOnly, buildReport, parseRows } from '../db-health.mjs';

test('SELECT and WITH reads pass, with write words allowed inside strings and comments', () => {
  assert.doesNotThrow(() => assertReadOnly('select count(*) from public.items'));
  assert.doesNotThrow(() => assertReadOnly("with t as (select 1) select * from t where 'a' <> 'delete from x';"));
  assert.doesNotThrow(() => assertReadOnly("select privilege_type from x where privilege_type in ('INSERT', 'UPDATE') -- drop it\n"));
  assert.doesNotThrow(() => assertReadOnly('select updated_at, relrowsecurity, set_config from x'));
});

test('anything that could write is refused before it runs', () => {
  for (const sql of [
    'delete from public.items',
    'update public.items set name = 1',
    'with d as (delete from public.items returning id) select * from d',
    'select 1; drop table public.items',
    'select * into new_table from public.items',
    'select 1 from x where y = $$a$$',
    'insert into x values (1)',
    'truncate public.items',
  ]) {
    assert.throws(() => assertReadOnly(sql), /db-health/, sql);
  }
});

test('rows come out of the CLI\'s JSON even with log lines before it', () => {
  assert.deepEqual(parseRows('Initialising login role...\n{"boundary":"x","rows":[{"a":1}],"warning":"w"}\n'), [{ a: 1 }]);
  assert.throws(() => parseRows('no json'), /No JSON/);
});

test('the report counts each check and names migration mismatches', () => {
  const empty = { test_named_drinks: [], test_named_bars: [], demo_bars: [], duplicate_drinks: [], unlinked_workspaces: [], rls_off: [], anon_write_grants: [], empty_tables: [], old_drafts: [], unreferenced_files: [] };
  const report = buildReport(
    { ...empty, migrations: [{ version: '1' }, { version: '2' }], rls_off: [{ table: 'private.x' }], old_drafts: [{ entity_type: 'menu', drafts: '3' }] },
    ['2', '3'],
  );
  assert.equal(report.summary.rls_off, 1);
  assert.equal(report.summary.drafts_older_than_60_days, 3);
  assert.deepEqual(report.migrations, { production: 2, on_disk: 2, not_in_production: ['3'], not_on_disk: ['1'] });
  assert.equal(report.summary.migrations_mismatched, 2);
});
