// Database health check: read-only SELECTs that look for the drift the
// 22 Oct 2026 audit found (test rows, duplicates, unlinked venues, open
// grants, RLS off, empty tables, stale drafts, migration mismatch, unused
// picture files). Prints one JSON report to stdout. Run weekly; it reports to
// HQ and changes nothing.
//
//   npm run db:health                       production (the linked project)
//   npm run db:health -- --local            the local stack
//   npm run db:health -- --workdir <dir>    use <dir>'s `supabase link`
//                                           (a fresh checkout is not linked)
//
// Two locks keep it read-only. assertReadOnly refuses anything but one
// SELECT or WITH statement with no write keyword in its code, before it
// reaches the CLI. Then Postgres itself refuses writes: production queries
// run inside BEGIN READ ONLY ... ROLLBACK, and local ones on a connection
// with default_transaction_read_only on. The report holds counts and the
// names of bars, drinks and tables only: never emails, user ids or people's
// names.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { maskSql } from './sql-code.mjs';
import { listMigrations, parseCliJson, supabaseJson, cliErrorMessage } from './supabase-cli.mjs';

const TEST_NAME = String.raw`\m(test|testing|asdf|tmp|dummy)\M`;
const DEMO = String.raw`\mdemo\M`;
// Real drinks whose names trip TEST_NAME.
const REAL_NAMES = `'test pilot'`;
const LIST_CAP = 200;

const WRITE_WORDS = /\b(insert|into|update|delete|merge|truncate|drop|alter|create|grant|revoke|copy|call|do|set|reset|lock|vacuum|analyze|refresh|comment|cluster|reindex|listen|notify|prepare|execute|begin|commit|rollback|savepoint|discard|load|import)\b/i;

/** Throws unless `sql` is a single read-only SELECT or WITH statement. */
export function assertReadOnly(sql) {
  // Judge the code only: literals (found before comments, so '--' in a
  // string is text) and comments can say anything.
  const { code, unterminated } = maskSql(sql);
  if (unterminated) throw new Error('db-health refuses SQL with an unclosed string, quoted name or comment.');
  const statement = code.trim().replace(/;\s*$/, '');
  if (statement.includes(';')) throw new Error('db-health runs one statement at a time.');
  if (!/^(select|with)\b/i.test(statement)) throw new Error(`db-health runs SELECT or WITH only, got: ${statement.slice(0, 60)}`);
  const word = WRITE_WORDS.exec(statement);
  if (word) throw new Error(`db-health refuses SQL containing "${word[1]}".`);
  return sql;
}

/**
 * The SQL sent to production: one transaction that Postgres keeps read-only
 * and rolls back. The Management API returns the SELECT's rows. The newlines
 * end any trailing -- comment in `sql`.
 */
export const readOnlyTransaction = (sql) => `begin read only;\n${sql}\n;\nrollback;`;

/** A local database URL whose sessions start read-only. */
export function readOnlyUrl(dbUrl) {
  return `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}options=-c%20default_transaction_read_only%3Don`;
}

const CHECKS = {
  // Drinks on a venue or a public bar page whose names look like tests.
  test_named_drinks: String.raw`
    select i.name, i.item_type::text as type, coalesce(b.name, p.display_name) as bar,
           (i.bar_id is not null) as venue, i.created_at::date as created
    from public.items i
    left join public.bars b on b.id = i.bar_id
    left join public.profiles p on p.id = i.origin_bar_profile_id
    where (i.bar_id is not null or i.origin_bar_profile_id is not null)
      and i.name ~* '${TEST_NAME}' and lower(btrim(i.name)) not in (${REAL_NAMES})
      and coalesce(b.name, '') !~* '${DEMO}' and coalesce(p.display_name, '') !~* '${DEMO}'
    order by 3, 1 limit ${LIST_CAP}`,

  // Venues and bar, maker or supplier pages with test names (never person pages).
  test_named_bars: String.raw`
    select 'workspace' as kind, name from public.bars
    where name ~* '${TEST_NAME}' and name !~* '${DEMO}'
    union all
    select kind::text, display_name from public.profiles
    where kind::text <> 'person' and display_name ~* '${TEST_NAME}' and display_name !~* '${DEMO}'
    order by 2 limit ${LIST_CAP}`,

  // Demo bars must stay hidden: list them with their visibility to check.
  demo_bars: String.raw`
    select 'workspace' as kind, name, page_visibility::text as visibility from public.bars where name ~* '${DEMO}'
    union all
    select kind::text, display_name, page_visibility::text from public.profiles
    where kind::text <> 'person' and display_name ~* '${DEMO}'
    order by 2 limit ${LIST_CAP}`,

  // The audit's duplicate query: same type and name under the same bar (and
  // the same maker, for ingredients).
  duplicate_drinks: String.raw`
    select i.item_type::text as type, min(i.name) as name, min(coalesce(b.name, p.display_name)) as bar, count(*) as copies
    from public.items i
    left join public.bars b on b.id = i.bar_id
    left join public.profiles p on p.id = i.origin_bar_profile_id
    group by i.item_type, lower(btrim(i.name)), i.bar_id, i.origin_bar_profile_id, i.maker_profile_id
    having count(*) > 1
    order by 3 nulls first, 2 limit ${LIST_CAP}`,

  // Venue workspaces with no public page linked through profiles.bar_id, and
  // how many unlinked bar pages share the name.
  unlinked_workspaces: String.raw`
    select b.name, b.created_at::date as created,
           (select count(*) from public.user_bars ub where ub.bar_id = b.id) as members,
           (select count(*) from public.profiles p
            where p.kind::text = 'bar' and p.bar_id is null
              and lower(btrim(p.display_name)) = lower(btrim(b.name))) as same_name_pages
    from public.bars b
    where not exists (select 1 from public.profiles p where p.bar_id = b.id)
    order by 1 limit ${LIST_CAP}`,

  rls_off: String.raw`
    select n.nspname || '.' || c.relname as "table"
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private') and c.relkind in ('r', 'p') and not c.relrowsecurity
    order by 1 limit ${LIST_CAP}`,

  // Table-level writes granted to anon or PUBLIC (grantee 0).
  anon_write_grants: String.raw`
    select n.nspname || '.' || c.relname as "table", string_agg(distinct a.privilege_type, ', ') as privileges
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(c.relacl) a
    where n.nspname in ('public', 'private') and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and a.grantee in ((select oid from pg_roles where rolname = 'anon'), 0)
      and a.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
    group by 1 order by 1 limit ${LIST_CAP}`,

  // Default privileges that give anon or PUBLIC writes on tables created
  // later (Supabase's setup grants ALL to anon by default). PR "second lock"
  // (fix/db-second-lock, #740) revokes postgres's in public; this says
  // whether any are still on.
  anon_default_privileges: String.raw`
    select pg_get_userbyid(d.defaclrole) as owner, coalesce(n.nspname, '(all schemas)') as schema,
           string_agg(distinct a.privilege_type, ', ') as privileges
    from pg_default_acl d
    left join pg_namespace n on n.oid = d.defaclnamespace
    cross join lateral aclexplode(d.defaclacl) a
    where d.defaclobjtype = 'r' and (n.nspname is null or n.nspname in ('public', 'private'))
      and a.grantee in ((select oid from pg_roles where rolname = 'anon'), 0)
      and a.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
    group by 1, 2 order by 1, 2 limit ${LIST_CAP}`,

  // Exact emptiness, one LIMIT 1 probe per table.
  empty_tables: String.raw`
    select n.nspname || '.' || c.relname as "table"
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private') and c.relkind in ('r', 'p') and not c.relispartition
      and (xpath('/row/c/text()', query_to_xml(
            format('select count(*) as c from (select 1 from %I.%I limit 1) s', n.nspname, c.relname),
            false, true, '')))[1]::text = '0'
    order by 1 limit ${LIST_CAP}`,

  old_drafts: String.raw`
    select entity_type, count(*) as drafts, min(coalesce(updated_at, created_at))::date as oldest
    from public.drafts
    where coalesce(updated_at, created_at) < now() - interval '60 days'
    group by 1 order by 2 desc limit ${LIST_CAP}`,

  // Files in storage that no column points at: every column that holds a
  // storage URL (found with information_schema on 22 Oct 2026), the JSON that
  // can carry one (drafts, drink versions, profile merges), and the list-size
  // thumbnail each drink picture has at thumbs/<path>.jpg. A new column that
  // stores pictures belongs here. The report says "check before deleting":
  // code can also point at a file by its path.
  // ponytail: capped at the newest 20,000 files so it stays quick; past that,
  // page through by created_at.
  unreferenced_files: String.raw`
    with urls as (
      select url as u from public.images
      union all select source_url from public.images
      union all select avatar_url from public.profiles
      union all select logo_url from public.bars
      union all select icon_url from public.bars
      union all select icon_url from public.items
      union all select photo_url from public.bar_zones
      union all select photo_url from public.item_locations
      union all select image_url from public.collected_items
      union all select cover_url from public.collected_releases
      union all select cover_url from public.releases
      union all select cover_url from public.menus
      union all select (regexp_matches(draft_data::text, '/storage/v1/[^"\s]+', 'g'))[1] from public.drafts
      union all select (regexp_matches(snapshot::text, '/storage/v1/[^"\s]+', 'g'))[1] from public.item_versions
      union all select (regexp_matches(snapshot::text, '/storage/v1/[^"\s]+', 'g'))[1] from private.profile_merges
    ), paths as (
      select substring(u from '/storage/v1/(?:object|render/image)/(?:public|sign|authenticated)/([^?#]+)') as path
      from urls where u is not null
    ), refs as (
      select path from paths
      union all
      select 'drinks/thumbs/' || regexp_replace(substr(path, 8), '\.[^./]+$', '') || '.jpg'
      from paths where path like 'drinks/%'
    ), objs as (
      select bucket_id, name, (metadata->>'size')::bigint as size
      from storage.objects order by created_at desc limit 20000
    )
    select o.bucket_id as bucket, count(*) as files, coalesce(sum(o.size), 0) as bytes,
           (select count(*) from storage.objects so where so.bucket_id = o.bucket_id) as bucket_files
    from objs o
    where not exists (select 1 from refs r where r.path = o.bucket_id || '/' || o.name)
    group by 1 order by 1`,
};

function makeRunner(args) {
  const local = args.includes('--local');
  const w = args.indexOf('--workdir');
  const workdir = w === -1 ? [] : ['--workdir', args[w + 1]];
  let dbUrl;
  if (local) {
    try {
      const status = execFileSync('supabase', ['status', '-o', 'json', ...workdir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      dbUrl = readOnlyUrl(parseCliJson(status).DB_URL);
    } catch (e) {
      throw new Error(`could not find the local database (is it running?): ${cliErrorMessage(e)}`);
    }
  }
  return {
    query(sql) {
      assertReadOnly(sql);
      const target = local ? ['--db-url', dbUrl] : ['--linked', ...workdir];
      const rows = supabaseJson(['db', 'query', ...target, '--output-format', 'json', local ? sql : readOnlyTransaction(sql)]).rows;
      if (!Array.isArray(rows)) throw new Error('supabase db query returned no rows array.');
      return rows;
    },
    appliedMigrations: () => listMigrations(local ? '--local' : '--linked', workdir).map((m) => m.remote).filter(Boolean),
  };
}

// Every list query ends in LIMIT LIST_CAP, so a full page means there are
// probably more.
const list = (rows) => ({ count: rows.length, capped: rows.length === LIST_CAP, rows });

export function buildReport(results, diskVersions, prodVersions) {
  const prod = new Set(prodVersions);
  const disk = new Set(diskVersions);
  const report = {
    test_named_drinks: list(results.test_named_drinks),
    test_named_bars: list(results.test_named_bars),
    demo_bars: list(results.demo_bars),
    duplicate_drinks: { groups: results.duplicate_drinks.length, capped: results.duplicate_drinks.length === LIST_CAP, rows: results.duplicate_drinks },
    unlinked_workspaces: {
      count: results.unlinked_workspaces.length,
      capped: results.unlinked_workspaces.length === LIST_CAP,
      with_same_name_page: results.unlinked_workspaces.filter((r) => Number(r.same_name_pages) > 0).length,
      rows: results.unlinked_workspaces,
    },
    rls_off: list(results.rls_off.map((r) => r.table)),
    anon_write_grants: {
      ...list(results.anon_write_grants),
      // Tables made later inherit these; #740 revokes postgres's in public.
      default_privileges_on: results.anon_default_privileges.length > 0,
      default_privileges: results.anon_default_privileges,
    },
    empty_tables: list(results.empty_tables.map((r) => r.table)),
    drafts_older_than_60_days: {
      count: results.old_drafts.reduce((n, r) => n + Number(r.drafts), 0),
      capped: results.old_drafts.length === LIST_CAP,
      rows: results.old_drafts,
    },
    migrations: {
      production: prod.size,
      on_disk: disk.size,
      not_in_production: diskVersions.filter((v) => !prod.has(v)),
      not_on_disk: prodVersions.filter((v) => !disk.has(v)),
    },
    unreferenced_files: {
      count: results.unreferenced_files.reduce((n, r) => n + Number(r.files), 0),
      bytes: results.unreferenced_files.reduce((n, r) => n + Number(r.bytes), 0),
      note: 'May still be in use: code can point at a file by its path. Check before deleting.',
      by_bucket: results.unreferenced_files,
    },
  };
  const summary = {
    test_named_drinks: report.test_named_drinks.count,
    test_named_bars: report.test_named_bars.count,
    demo_bars: report.demo_bars.count,
    duplicate_drink_groups: report.duplicate_drinks.groups,
    unlinked_workspaces: report.unlinked_workspaces.count,
    rls_off: report.rls_off.count,
    anon_write_grant_tables: report.anon_write_grants.count,
    anon_default_write_privileges_on: report.anon_write_grants.default_privileges_on,
    empty_tables: report.empty_tables.count,
    drafts_older_than_60_days: report.drafts_older_than_60_days.count,
    migrations_production: report.migrations.production,
    migrations_on_disk: report.migrations.on_disk,
    migrations_mismatched: report.migrations.not_in_production.length + report.migrations.not_on_disk.length,
    unreferenced_files: report.unreferenced_files.count,
  };
  return { summary, ...report };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const fail = (name, e) => {
    console.error(`db-health: ${name} failed: ${e.message.slice(0, 500)}`);
    process.exit(2);
  };
  let runner;
  try {
    runner = makeRunner(args);
  } catch (e) {
    fail('setup', e);
  }
  const results = {};
  for (const [name, sql] of Object.entries(CHECKS)) {
    try {
      results[name] = runner.query(sql);
    } catch (e) {
      fail(name, e);
    }
  }
  let prodVersions;
  try {
    prodVersions = runner.appliedMigrations();
  } catch (e) {
    fail('migrations', e);
  }
  const diskVersions = readdirSync(join('supabase', 'migrations'))
    .map((f) => /^(\d{14})_.+\.sql$/.exec(f)?.[1])
    .filter(Boolean)
    .sort();
  const report = buildReport(results, diskVersions, prodVersions);
  console.log(JSON.stringify({ generated_at: new Date().toISOString(), target: args.includes('--local') ? 'local' : 'linked', ...report }, null, 2));
}
