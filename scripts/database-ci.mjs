// Does a PR need CI's "Migrations and security tests" job? It rebuilds the
// database and runs supabase/tests (about 20 minutes, in three parallel
// shards), so a PR that changes none of what that job reads skips it. A skipped job still passes the
// required check, so UI-only PRs merge as soon as the rest of CI is green.
//
//   git diff --name-only HEAD^1 HEAD | node scripts/database-ci.mjs
//
// Prints "database=true" or "database=false" for $GITHUB_OUTPUT.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// What the job runs on, outside supabase/.
const ALWAYS = new Set([
  'package.json',
  'package-lock.json',
  '.nvmrc',
  '.github/workflows/ci.yml',
  'scripts/check-local-migrations.mjs',
  'scripts/database-ci.mjs',
  'scripts/security-shard.mjs',
  'scripts/db-snapshot.mjs',
  // Checked against the migrations by regenerating it (npm run gen:types).
  'types/database.ts',
]);

const isFile = (root, path) => existsSync(join(root, path)) && statSync(join(root, path)).isFile();

/**
 * App files the security tests read ('../../hooks/useBarFacts.ts', compared
 * as text) or run (tsImport('../../lib/drinkStyles.ts')), plus every file a
 * run file imports in turn, so a change to any of them still runs the job.
 */
export function testedAppFiles(root = ROOT) {
  const tests = join(root, 'supabase/tests');
  const queue = [];
  for (const name of readdirSync(tests).filter((f) => f.endsWith('.mjs'))) {
    const source = readFileSync(join(tests, name), 'utf8');
    for (const m of source.matchAll(/(import\(\s*|from\s+)?['"`]\.\.\/\.\.\/([^'"`]+)['"`]/g)) {
      queue.push({ file: m[2], runs: !!m[1] || /tsImport\(\s*$/.test(source.slice(0, m.index)) });
    }
  }
  const seen = new Set();
  const followed = new Set();
  while (queue.length) {
    const { file: path, runs } = queue.pop();
    const file = normalize(path);
    if (!isFile(root, file)) continue;
    seen.add(file);
    if (!runs || followed.has(file) || !/\.(ts|tsx|js|mjs)$/.test(file)) continue;
    followed.add(file);
    for (const m of readFileSync(join(root, file), 'utf8').matchAll(/from\s+['"]((?:\.{1,2}|@)\/[^'"]+)['"]/g)) {
      const base = m[1].startsWith('@/') ? m[1].slice(2) : join(dirname(file), m[1]);
      const hit = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts'].map((ext) => normalize(base + ext)).find((p) => isFile(root, p));
      if (hit) queue.push({ file: hit, runs: true });
    }
  }
  return seen;
}

export function needsDatabase(changed, tested = testedAppFiles()) {
  return changed.some((f) => f.startsWith('supabase/') || ALWAYS.has(f) || tested.has(f));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const changed = readFileSync(0, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  // No file list means something went wrong upstream: run the job.
  console.log(`database=${!changed.length || needsDatabase(changed)}`);
}
