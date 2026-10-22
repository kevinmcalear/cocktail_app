import { test } from 'node:test';
import assert from 'node:assert/strict';

import { migrationRuleProblems } from '../migration-rules.mjs';

const FILE = '20261102100000_example.sql';
const check = (sql) => migrationRuleProblems(FILE, sql);

// --- header ---

test('a header that says what the migration does passes', () => {
  assert.deepEqual(check('-- Bars get a closing time.\n-- The drafts table keeps a draft per user.\nalter table public.bars add column closes_at time;\n'), []);
});

test('DRAFT, "not applied" and "Local stack only" in the header are refused, even across a wrapped line', () => {
  const [p] = check('-- DRAFT. Local stack only until Kevin\'s OK.\nselect 1;\n');
  assert.match(p, /header says "DRAFT", "Local stack only"/);
  assert.match(p, /say what it does instead/);
  assert.equal(check('-- Venue switches. Local stack\n-- only until Kevin\'s OK.\nselect 1;\n').length, 1);
  assert.equal(check('/* Not applied to production; needs review. */\nselect 1;\n').length, 1);
  assert.equal(check('-- Draft: schema proposal section 2.\nselect 1;\n').length, 1);
});

test('the same words below the header, or "draft" mid-sentence, pass', () => {
  assert.deepEqual(check('-- Fact-checked (draft: an artifact).\nselect 1;\n-- DRAFT. Local stack only.\n'), []);
});

// --- grants to anon and public ---

test('a write grant to anon or public is refused, with the line number', () => {
  const [p] = check('-- Grants.\ngrant select on public.bars to anon;\ngrant insert, update on table public.bars to authenticated, anon;\n');
  assert.match(p, /^20261102100000_example\.sql:3: grants INSERT to anon\. .*allow-anon-write/);
  assert.equal(check('GRANT ALL ON TABLE "public"."bars" TO "anon";').length, 1);
  assert.equal(check('grant delete on public.bars to public;').length, 1);
  assert.equal(check('alter default privileges in schema public\n  grant all on tables to anon;').length, 1);
});

test('reads, executes, revokes, other roles and commented-out grants pass', () => {
  const sql = [
    '-- Grants.',
    'grant select on public.bars to anon, authenticated;',
    'grant execute on function public.shared_menu(uuid) to anon;',
    'grant all on public.bars to authenticated, service_role;',
    'grant insert on public.bars to authenticated; -- not anon',
    'revoke insert, update, delete on public.bars from anon;',
    '-- grant insert on public.bars to anon;',
    "select 'grant insert on public.bars to anon;';",
  ].join('\n');
  assert.deepEqual(check(sql), []);
});

test('an allow-anon-write comment with a reason lets a write grant through', () => {
  assert.deepEqual(check('-- Grants.\ngrant insert on public.page_views to anon; -- allow-anon-write: signed-out visits count\n'), []);
  assert.deepEqual(check('-- Grants.\n-- allow-anon-write: signed-out visits count\ngrant insert on public.page_views to anon;\n'), []);
  assert.equal(check('grant insert on public.page_views to anon; -- allow-anon-write:\n').length, 1, 'needs a reason');
});

// --- RLS on new tables ---

test('a new public or unqualified table without RLS is refused, naming the line to add', () => {
  const problems = check('-- Notes.\ncreate table public.notes (id uuid);\ncreate table if not exists "tags" (id uuid);\n');
  assert.deepEqual(problems, [
    `${FILE}:2: creates public.notes without RLS. Add \`alter table public.notes enable row level security;\` and its policies in the same file.`,
    `${FILE}:3: creates public.tags without RLS. Add \`alter table public.tags enable row level security;\` and its policies in the same file.`,
  ]);
});

test('a new table with RLS, a private or temp table, and a commented-out table pass', () => {
  const sql = [
    '-- Notes.',
    'create table public.notes (id uuid);',
    'alter table public.notes enable row level security;',
    'create table "public"."tags" (id uuid);',
    'ALTER TABLE ONLY "public"."tags" ENABLE ROW LEVEL SECURITY;',
    'create table private.jobs (id uuid);',
    'create temp table scratch (id uuid);',
    '-- create table public.old (id uuid);',
  ].join('\n');
  assert.deepEqual(check(sql), []);
});
