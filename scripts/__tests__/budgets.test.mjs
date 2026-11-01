import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants } from 'node:zlib';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'budgets.mjs');
const JS = '_expo/static/js/web';
const br = (file) => brotliCompressSync(readFileSync(file), { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;

/** A fake export: a public drink page loading two scripts, a third script no page loads, and budgets for them. */
function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'budgets-'));
  mkdirSync(join(dir, 'dist', JS), { recursive: true });
  mkdirSync(join(dir, 'dist', 'd'));
  mkdirSync(join(dir, 'quality'));
  for (const name of ['entry', 'common', 'other']) writeFileSync(join(dir, 'dist', JS, `${name}.js`), randomBytes(3000).toString('hex'));
  writeFileSync(join(dir, 'dist', 'd', '[id].html'), `<link rel="preload" href="/${JS}/entry.js"><script src="/${JS}/entry.js"></script><script src="/${JS}/common.js"></script>`);
  const page = br(join(dir, 'dist', JS, 'entry.js')) + br(join(dir, 'dist', JS, 'common.js'));
  const all = 3 * 6000;
  return { dir, page, all };
}

function write(dir, { page, all, limit = 1_000_000, table = true }) {
  const budgets = [
    { id: 'B1', current: null },
    { id: 'B12', noise: 100, current: { webJs: all } },
    {
      id: 'B13',
      noise: 100,
      current: { '/d/[id]': page },
      limit: { '/d/[id]': limit, ...(table ? { 'table page': 50 } : {}) },
      pending: table ? { 'table page': 'no route yet' } : {},
    },
  ];
  writeFileSync(join(dir, 'quality', 'budgets.json'), JSON.stringify({ budgets }));
}

const run = (dir, args = [], env = {}) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, VERCEL: '', ...env } });
const recorded = (dir) => JSON.parse(readFileSync(join(dir, 'quality', 'budgets.json'), 'utf8')).budgets;

test('numbers as recorded pass; a pending page is skipped with its reason', () => {
  const s = setup();
  write(s.dir, s);
  const r = run(s.dir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /table page: skipped\. no route yet/);
  assert.match(r.stdout, /check:budgets: ok/);
});

test('a page over its limit passes when it did not get worse, and the gap is reported', () => {
  const s = setup();
  write(s.dir, { ...s, limit: 1024 });
  const r = run(s.dir);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /over its 1\.0 KB limit/);
});

test('growth within noise passes; more fails, for a page and for all the JS', () => {
  const s = setup();
  write(s.dir, { ...s, page: s.page - 50, all: s.all - 50 });
  assert.equal(run(s.dir).status, 0);
  write(s.dir, { ...s, page: s.page - 500 });
  const page = run(s.dir);
  assert.equal(page.status, 1);
  assert.match(page.stderr, /B13 \/d\/\[id\]: .* worse/);
  write(s.dir, { ...s, all: s.all - 500 });
  const all = run(s.dir);
  assert.equal(all.status, 1);
  assert.match(all.stderr, /B12 webJs: .* worse/);
});

test('a script the page does not load counts for B12 only', () => {
  const s = setup();
  write(s.dir, { ...s, all: s.all + 1000 });
  appendFileSync(join(s.dir, 'dist', JS, 'other.js'), randomBytes(1000).toString('hex'));
  const r = run(s.dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /B12 webJs/);
  assert.doesNotMatch(r.stderr, /B13/);
});

test('--update locks gains and records new numbers, never loosens, and still fails on the worse one', () => {
  const s = setup();
  write(s.dir, { ...s, page: s.page + 500, all: s.all - 500 });
  const budgets = JSON.parse(readFileSync(join(s.dir, 'quality', 'budgets.json'), 'utf8'));
  budgets.budgets[2].current['/d/[id]'] = null;
  budgets.budgets[2].limit['/new'] = 10;
  writeFileSync(join(s.dir, 'quality', 'budgets.json'), JSON.stringify(budgets));
  writeFileSync(join(s.dir, 'dist', 'new.html'), `<script src="/${JS}/entry.js"></script>`);
  const r = run(s.dir, ['--update']);
  assert.equal(r.status, 1, 'the worse B12 still fails');
  const [, b12, b13] = recorded(s.dir);
  assert.equal(b12.current.webJs, s.all - 500, 'a worse number is not loosened');
  assert.equal(b13.current['/d/[id]'], s.page, 'an unrecorded number is recorded');
  assert.equal(b13.current['/new'], br(join(s.dir, 'dist', JS, 'entry.js')), 'a new page is recorded');
  write(s.dir, { ...s, page: s.page + 500 });
  assert.equal(run(s.dir, ['--update']).status, 0);
  assert.equal(recorded(s.dir)[2].current['/d/[id]'], s.page, 'a gain is locked in');
});

test('an unrecorded number or a missing page fails the check', () => {
  const s = setup();
  write(s.dir, { ...s, page: null });
  assert.match(run(s.dir).stderr, /no recorded number/);
  write(s.dir, s);
  const budgets = JSON.parse(readFileSync(join(s.dir, 'quality', 'budgets.json'), 'utf8'));
  budgets.budgets[2].limit['/m/[id]'] = 10;
  writeFileSync(join(s.dir, 'quality', 'budgets.json'), JSON.stringify(budgets));
  const r = run(s.dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /\/m\/\[id\]: no page for it/);
});

test('a Vercel deploy reports a worse number without failing', () => {
  const s = setup();
  write(s.dir, { ...s, page: s.page - 500 });
  const r = run(s.dir, [], { VERCEL: '1' });
  assert.equal(r.status, 0);
  assert.match(r.stderr, /Reported only/);
});

test('no export fails with what to run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'budgets-'));
  const r = run(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no web export/);
});
