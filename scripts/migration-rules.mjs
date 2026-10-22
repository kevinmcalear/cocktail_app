// Migration rules: checks the migrations a branch adds or changes (not the
// ones main already has, which are applied and stay as they are).
//
//   1. The header says what the migration does. No "DRAFT", "Local stack
//      only" or "Not applied to production" markers: every merged migration
//      is applied, so they mislead whoever reads them later (the 22 Oct
//      audit found 71).
//   2. No INSERT, UPDATE, DELETE, TRUNCATE or ALL on a table granted to anon
//      or public, including `ALTER DEFAULT PRIVILEGES ... GRANT` and the
//      `GRANT ALL ON TABLE ... TO "anon"` lines `supabase db diff` writes
//      (drop those, or grant SELECT). RLS is the first lock; table grants are
//      the second. A deliberate one carries `-- allow-anon-write: <reason>`
//      in its own statement (on its lines or the -- lines directly above).
//      The default privileges Supabase sets up, which gave anon writes on
//      every table, are not in any migration; PR "second lock"
//      (fix/db-second-lock, #740) revokes them, and `npm run db:health`
//      reports whether any are still on.
//   3. A table created in public (or unqualified) has ENABLE ROW LEVEL
//      SECURITY in the same file. Production also has Supabase's platform
//      ensure_rls event trigger (rls_auto_enable), but no migration creates
//      it, so local stacks and fresh projects don't; CI says it on the PR.
//
//   node scripts/migration-rules.mjs [base-ref]   (default origin/main)
//
// ponytail: a regex reader, not a SQL parser. It ignores comments and quoted
// strings (scripts/sql-code.mjs), and reads function and DO bodies as code,
// but SQL built at run time (EXECUTE format(...)) slips past it; the security
// tests cover those.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { maskSql } from './sql-code.mjs';

const DIR = 'supabase/migrations';

/** The comment block at the top of the file, as one line of text. */
function headerText(sql) {
  const out = [];
  let inBlock = false;
  for (const line of sql.split('\n')) {
    const t = line.trim();
    if (inBlock) {
      out.push(t.replace(/\*\/.*$/, '').replace(/^\*+\s*/, '').trim());
      if (t.includes('*/')) inBlock = false;
    } else if (t === '') {
      continue;
    } else if (t.startsWith('--')) {
      out.push(t.replace(/^-+\s?/, ''));
    } else if (t.startsWith('/*')) {
      out.push(t.replace(/^\/\*+/, '').replace(/\*\/.*$/, '').trim());
      inBlock = !t.includes('*/');
    } else {
      break;
    }
  }
  return out;
}

const lineAt = (sql, index) => sql.slice(0, index).split('\n').length;

// The markers the repo's migrations used ("DRAFT. Local stack only until
// Kevin's OK.", "Not applied to production; needs Kevin's review first.").
// "Draft" opening a line is a marker only before ".", ":" or "(" ("Draft
// menus can be shared." is about the feature), and "not applied" only when
// "to production" follows ("not applied twice" is fine). The phrases are
// matched across wrapped lines.
const STALE_HEADER = [
  { re: /^DRAFT\b/, says: 'DRAFT', perLine: true },
  { re: /^draft\s*[.:(]/i, says: 'DRAFT', perLine: true },
  { re: /\blocal stack only\b/i, says: 'Local stack only' },
  { re: /\bnot applied to production\b/i, says: 'Not applied to production' },
];

function headerProblems(file, sql) {
  const lines = headerText(sql);
  const joined = lines.join(' ');
  const hits = STALE_HEADER.filter(({ re, perLine }) => (perLine ? lines.some((l) => re.test(l)) : re.test(joined)));
  if (!hits.length) return [];
  const words = [...new Set(hits.map((h) => `"${h.says}"`))].join(', ');
  return [`${file}: the header says ${words}. Every merged migration is applied to production, so say what it does instead and drop that line.`];
}

const NAME = String.raw`(?:"[^"]+"|[\w$]+)`;
const QUALIFIED = String.raw`${NAME}(?:\s*\.\s*${NAME})?`;
const WRITE_PRIVILEGE = /\b(insert|update|delete|truncate|all)\b/i;
const OPEN_ROLE = /(^|[\s,])"?(anon|public)"?(?=$|[\s,])/i;
const ALLOW = /allow-anon-write:\s*\S/i;
// ALL on a function, procedure or routine is EXECUTE: not a write. (A table
// called "functions" is still a table: `on functions to anon` does not match.)
const ROUTINE = /^\s*(?:all\s+(?:functions|procedures|routines)\s+in\b|(?:function|procedure|routine)\s+(?!to\b)\S)/i;

function grantProblems(file, sql, code) {
  const problems = [];
  // Strings blanked but comments kept: where an allow comment can be.
  const notes = maskSql(sql, { dollar: 'code', comments: 'keep' }).code;
  const lines = sql.split('\n');
  // [^;] keeps each match inside one statement (GRANT role TO role has no ON).
  // The comments that belong to one statement: the -- lines directly above
  // it, those inside it, and one trailing its last line when no other
  // statement follows on that line. Never text in a string.
  const ownComments = (start, end, firstLine) => {
    const above = [];
    for (let k = firstLine - 2; k >= 0 && lines[k].trim().startsWith('--'); k--) above.push(lines[k]);
    const lineEnd = sql.indexOf('\n', end) === -1 ? sql.length : sql.indexOf('\n', end);
    const tail = code.slice(end + 1, lineEnd).trim() === '' ? notes.slice(end, lineEnd) : '';
    return [...above, notes.slice(start, end), tail].join('\n');
  };
  for (const m of code.matchAll(/\bgrant\b([^;]*?)\bon\b([^;]*?)\bto\b([^;]*)/gi)) {
    const [, privileges, object, grantees] = m;
    const roles = grantees.replace(/\bwith\s+grant\s+option\b/i, '').replace(/\bgranted\s+by\b[\s\S]*$/i, '');
    if (!WRITE_PRIVILEGE.test(privileges) || !OPEN_ROLE.test(roles) || ROUTINE.test(object)) continue;
    const first = lineAt(sql, m.index);
    if (ALLOW.test(ownComments(m.index, m.index + m[0].length, first))) continue;
    const priv = WRITE_PRIVILEGE.exec(privileges)[1].toUpperCase();
    const role = OPEN_ROLE.exec(roles)[2].toLowerCase();
    problems.push(`${file}:${first}: grants ${priv} to ${role}. Signed-out visitors must not get table writes: grant to authenticated instead, or add \`-- allow-anon-write: <reason>\` to that statement if it is deliberate.`);
  }
  return problems;
}

const unquote = (name) => name.replace(/\s+/g, '').replace(/"/g, '').toLowerCase();
const bare = (name) => unquote(name).replace(/^public\./, '');

function rlsProblems(file, sql, code) {
  const created = [];
  const tableRe = new RegExp(String.raw`\bcreate\s+(?:(global|local)\s+)?(?:(temp|temporary|unlogged)\s+)?table\s+(?:if\s+not\s+exists\s+)?(${QUALIFIED})`, 'gi');
  for (const m of code.matchAll(tableRe)) {
    if (/^temp/i.test(m[2] ?? '')) continue;
    const name = unquote(m[3]);
    if (name.includes('.') && !name.startsWith('public.')) continue;
    created.push({ name: bare(m[3]), line: lineAt(sql, m.index) });
  }
  if (!created.length) return [];
  const enabled = new Set();
  const rlsRe = new RegExp(String.raw`\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(${QUALIFIED})\s+enable\s+row\s+level\s+security\b`, 'gi');
  for (const m of code.matchAll(rlsRe)) enabled.add(bare(m[1]));
  return created
    .filter(({ name }) => !enabled.has(name))
    .map(({ name, line }) => `${file}:${line}: creates public.${name} without RLS. Add \`alter table public.${name} enable row level security;\` and its policies in the same file.`);
}

/** What's wrong with one migration file's SQL. */
export function migrationRuleProblems(file, sql) {
  const { code } = maskSql(sql, { dollar: 'code' });
  return [...headerProblems(file, sql), ...grantProblems(file, sql, code), ...rlsProblems(file, sql, code)];
}

/** Migration files the working tree adds or changes compared with `ref`. */
export function changedMigrations(ref) {
  return execFileSync('git', ['diff', '--name-only', '--no-renames', '--diff-filter=AM', ref, '--', DIR], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.endsWith('.sql'));
}

/**
 * The problems `after` adds to a migration that was `before` (null for a new
 * file). Editing an applied migration, say to fix its stale header, is not
 * blamed for the old lines it kept.
 */
export function newProblems(file, before, after) {
  const key = (p) => p.replace(/^([^:]+):\d+:/, '$1:');
  const old = before === null ? [] : migrationRuleProblems(file, before).map(key);
  return migrationRuleProblems(file, after).filter((p) => {
    const i = old.indexOf(key(p));
    if (i === -1) return true;
    old.splice(i, 1);
    return false;
  });
}

function baseVersion(ref, path) {
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ref = process.argv[2] ?? 'origin/main';
  // On a PR, CI checks out GitHub's merge commit, so this diff is the PR's own
  // migrations. Untracked files count too, for running it locally.
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', DIR], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.endsWith('.sql'));
  const files = [...new Set([...changedMigrations(ref), ...untracked])].sort();
  const problems = files.flatMap((f) => newProblems(f.replace(`${DIR}/`, ''), baseVersion(ref, f), readFileSync(f, 'utf8')));
  if (problems.length) {
    console.error(`Migration rules (files added or changed against ${ref}):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(`Migration rules OK (${files.length} new or changed file${files.length === 1 ? '' : 's'} against ${ref}).`);
}
