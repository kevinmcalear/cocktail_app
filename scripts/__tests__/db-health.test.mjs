import { test } from 'node:test';
import assert from 'node:assert/strict';

import { assertReadOnly, buildReport, readOnlyTransaction, readOnlyUrl } from '../db-health.mjs';
import { cliErrorMessage, parseCliJson } from '../supabase-cli.mjs';

test('SELECT and WITH reads pass, with write words allowed inside strings and comments', () => {
  assert.doesNotThrow(() => assertReadOnly('select count(*) from public.items'));
  assert.doesNotThrow(() => assertReadOnly("with t as (select 1) select * from t where 'a' <> 'delete from x';"));
  assert.doesNotThrow(() => assertReadOnly("select privilege_type from x where privilege_type in ('INSERT', 'UPDATE') -- drop it\n"));
  assert.doesNotThrow(() => assertReadOnly('select updated_at, relrowsecurity, set_config from x'));
  assert.doesNotThrow(() => assertReadOnly("select $q$'; delete from x; --$q$, E'it\\'s; drop' from x"), 'literals, even dollar-quoted and E strings');
  assert.doesNotThrow(() => assertReadOnly('select 1 /* outer /* inner */ ; delete from x */'), 'nested comments');
});

test('anything that could write is refused before it runs', () => {
  for (const sql of [
    'delete from public.items',
    'update public.items set name = 1',
    'with d as (delete from public.items returning id) select * from d',
    'select 1; drop table public.items',
    'select * into new_table from public.items',
    "select 1 where 'x' = '--'; delete from public.items",
    "select 'a\\'; delete from public.items; --'",
    "select E'a\\\\'; delete from public.items",
    'select $$a$$; delete from public.items',
    'select 1 /* a */ ; delete from public.items',
    "select 1 where 'unclosed",
    'select 1 /* unclosed',
    'select $$unclosed',
    'insert into x values (1)',
    'truncate public.items',
  ]) {
    assert.throws(() => assertReadOnly(sql), /db-health/, sql);
  }
});

test('Postgres refuses writes too: production runs in a read-only transaction, local on a read-only session', () => {
  assert.equal(readOnlyTransaction('select 1 -- note'), 'begin read only;\nselect 1 -- note\n;\nrollback;');
  assert.equal(readOnlyUrl('postgresql://u:p@127.0.0.1:54322/postgres'), 'postgresql://u:p@127.0.0.1:54322/postgres?options=-c%20default_transaction_read_only%3Don');
  assert.match(readOnlyUrl('postgresql://h/db?sslmode=disable'), /\?sslmode=disable&options=/);
});

test('the CLI\'s JSON is read past log lines, and its JSON error is what a failure says', () => {
  assert.deepEqual(parseCliJson('Initialising login role...\n{"boundary":"x","rows":[{"a":1}],"warning":"w"}\n').rows, [{ a: 1 }]);
  assert.throws(() => parseCliJson('no json'), /No JSON/);
  const stdout = 'Connecting to local database...\n{"_tag":"Error","error":{"code":"X","message":"failed to execute query: boom"}}';
  assert.equal(cliErrorMessage({ stdout, stderr: '', message: 'Command failed' }), 'failed to execute query: boom');
  assert.equal(cliErrorMessage({ stdout: '', stderr: 'not linked', message: 'Command failed' }), 'not linked');
});

test('the report counts each check and names migration mismatches', () => {
  const empty = { test_named_drinks: [], test_named_bars: [], demo_bars: [], duplicate_drinks: [], unlinked_workspaces: [], rls_off: [], anon_write_grants: [], anon_default_privileges: [], empty_tables: [], old_drafts: [], unreferenced_files: [] };
  const report = buildReport(
    { ...empty, rls_off: [{ table: 'private.x' }], old_drafts: [{ entity_type: 'menu', drafts: '3' }], anon_default_privileges: [{ owner: 'postgres', schema: 'public', privileges: 'INSERT' }] },
    ['2', '3'],
    ['1', '2'],
  );
  assert.equal(report.summary.anon_default_write_privileges_on, true);
  assert.equal(report.rls_off.capped, false);
  assert.equal(buildReport({ ...empty, rls_off: Array.from({ length: 200 }, (_, i) => ({ table: `t${i}` })) }, [], []).rls_off.capped, true);
  assert.match(report.unreferenced_files.note, /Check before deleting/);
  assert.equal(report.summary.rls_off, 1);
  assert.equal(report.summary.drafts_older_than_60_days, 3);
  assert.deepEqual(report.migrations, { production: 2, on_disk: 2, not_in_production: ['3'], not_on_disk: ['1'] });
  assert.equal(report.summary.migrations_mismatched, 2);
});
