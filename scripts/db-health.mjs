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
// Every query must start with SELECT or WITH and hold no write keyword; the
// guard below refuses anything else before it reaches the CLI. The report
// holds counts and the names of bars, drinks and tables only: never emails,
// user ids or people's names.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const TEST_NAME = String.raw`\m(test|testing|asdf|tmp|dummy)\M`;
const DEMO = String.raw`\mdemo\M`;
// Real drinks whose names trip TEST_NAME.
const REAL_NAMES = `'test pilot'`;
const LIST_CAP = 200;

const WRITE_WORDS = /\b(insert|into|update|delete|merge|truncate|drop|alter|create|grant|revoke|copy|call|do|set|reset|lock|vacuum|analyze|refresh|comment|cluster|reindex|listen|notify|prepare|execute|begin|commit|rollback|savepoint|discard|load|import)\b/i;

/** Throws unless `sql` is a single read-only SELECT or WITH statement. */
export function assertReadOnly(sql) {
  // Judge the code only: string literals and comments can say anything.
  const code = sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
    .trim()
    .replace(/;\s*$/, '');
  if (!/^(select|with)\b/i.test(code)) throw new Error(`db-health runs SELECT or WITH only, got: ${code.slice(0, 60)}`);
  if (code.includes(';')) throw new Error('db-health runs one statement at a time.');
  if (code.includes('$')) throw new Error('db-health does not run dollar-quoted SQL.');
  const word = WRITE_WORDS.exec(code);
  if (word) throw new Error(`db-health refuses SQL containing "${word[1]}".`);
  return sql;
}

/** The rows from `supabase db query --output-format json` (it may log lines before the JSON). */
export function parseRows(stdout) {
  const start = stdout.indexOf('{');
  if (start === -1) throw new Error(`No JSON in supabase output: ${stdout.slice(0, 200)}`);
  const parsed = JSON.parse(stdout.slice(start));
  if (!Array.isArray(parsed.rows)) throw new Error(`Unexpected supabase output: ${stdout.slice(0, 200)}`);
  return parsed.rows;
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
    order by 1`,

  // Table-level writes granted to anon or PUBLIC (grantee 0).
  anon_write_grants: String.raw`
    select n.nspname || '.' || c.relname as "table", string_agg(distinct a.privilege_type, ', ') as privileges
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(c.relacl) a
    where n.nspname in ('public', 'private') and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and a.grantee in ((select oid from pg_roles where rolname = 'anon'), 0)
      and a.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
    group by 1 order by 1`,

  // Exact emptiness, one LIMIT 1 probe per table.
  empty_tables: String.raw`
    select n.nspname || '.' || c.relname as "table"
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private') and c.relkind in ('r', 'p') and not c.relispartition
      and (xpath('/row/c/text()', query_to_xml(
            format('select count(*) as c from (select 1 from %I.%I limit 1) s', n.nspname, c.relname),
            false, true, '')))[1]::text = '0'
    order by 1`,

  old_drafts: String.raw`
    select entity_type, count(*) as drafts, min(coalesce(updated_at, created_at))::date as oldest
    from public.drafts
    where coalesce(updated_at, created_at) < now() - interval '60 days'
    group by 1 order by 2 desc`,

  migrations: String.raw`select version from supabase_migrations.schema_migrations order by 1`,

  // Files in storage that none of the five picture URL columns point at.
  // ponytail: capped at the newest 20,000 files so it stays quick; past that,
  // page through by created_at.
  unreferenced_files: String.raw`
    with refs as (
      select substring(u from '/storage/v1/(?:object|render/image)/(?:public|sign|authenticated)/([^?#]+)') as path
      from (
        select url as u from public.images
        union all select avatar_url from public.profiles
        union all select logo_url from public.bars
        union all select image_url from public.collected_items
        union all select cover_url from public.menus
      ) s
      where u is not null
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
  const target = args.includes('--local') ? '--local' : '--linked';
  const w = args.indexOf('--workdir');
  const workdir = w === -1 ? [] : ['--workdir', args[w + 1]];
  return (sql) => {
    assertReadOnly(sql);
    const out = execFileSync('supabase', ['db', 'query', target, ...workdir, '--output-format', 'json', sql], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
    return parseRows(out);
  };
}

const list = (rows) => ({ count: rows.length, capped: rows.length >= LIST_CAP, rows });

export function buildReport(results, diskVersions) {
  const prodVersions = results.migrations.map((r) => r.version);
  const prod = new Set(prodVersions);
  const disk = new Set(diskVersions);
  const report = {
    test_named_drinks: list(results.test_named_drinks),
    test_named_bars: list(results.test_named_bars),
    demo_bars: list(results.demo_bars),
    duplicate_drinks: { groups: results.duplicate_drinks.length, rows: results.duplicate_drinks },
    unlinked_workspaces: {
      count: results.unlinked_workspaces.length,
      with_same_name_page: results.unlinked_workspaces.filter((r) => Number(r.same_name_pages) > 0).length,
      rows: results.unlinked_workspaces,
    },
    rls_off: list(results.rls_off.map((r) => r.table)),
    anon_write_grants: list(results.anon_write_grants),
    empty_tables: list(results.empty_tables.map((r) => r.table)),
    drafts_older_than_60_days: {
      count: results.old_drafts.reduce((n, r) => n + Number(r.drafts), 0),
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
  const run = makeRunner(args);
  const results = {};
  for (const [name, sql] of Object.entries(CHECKS)) {
    try {
      results[name] = run(sql);
    } catch (e) {
      console.error(`db-health: ${name} failed: ${(e.stderr || e.message || String(e)).toString().slice(0, 500)}`);
      process.exit(2);
    }
  }
  const diskVersions = readdirSync(join('supabase', 'migrations'))
    .map((f) => /^(\d{14})_.+\.sql$/.exec(f)?.[1])
    .filter(Boolean)
    .sort();
  const report = buildReport(results, diskVersions);
  console.log(JSON.stringify({ generated_at: new Date().toISOString(), target: args.includes('--local') ? 'local' : 'linked', ...report }, null, 2));
}
