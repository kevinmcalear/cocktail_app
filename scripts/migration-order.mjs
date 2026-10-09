// Migration numbers: every migration a branch adds must sort after main's
// latest, and no two may share a number.
//
// Merging to main applies migrations to production (Deploy migrations runs
// `supabase db push`, without --include-all), and production refuses a file
// numbered below its latest. Sessions pick numbers from their own snapshot of
// main while it keeps moving, so a number that was fine when the branch was cut
// can be stale by merge time, or taken by another PR. This makes that show on
// the PR instead of at deploy.
//
//   node scripts/migration-order.mjs [base-ref]   (default origin/main)
//
// ponytail: a PR that went green before main moved stays green until its CI
// runs again. Renumber right before merging; upgrade path is a required check
// that re-runs on every push to main.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DIR = 'supabase/migrations';
const VERSION = /^(\d{14})_.+\.sql$/;

const versionOf = (file) => VERSION.exec(file)?.[1] ?? null;

/** What's wrong with the branch's migration files, next to the base's. */
export function migrationProblems(baseFiles, headFiles) {
  const problems = [];
  const base = new Set(baseFiles);
  const latest = baseFiles.map(versionOf).filter(Boolean).sort().at(-1) ?? '';

  const byVersion = new Map();
  for (const file of headFiles) {
    const version = versionOf(file);
    if (!version) {
      if (file.endsWith('.sql')) problems.push(`${file}: name it <14-digit version>_<name>.sql.`);
      continue;
    }
    byVersion.set(version, [...(byVersion.get(version) ?? []), file]);
  }
  for (const [version, files] of byVersion) {
    if (files.length > 1) problems.push(`${files.join(' and ')} share the number ${version}; renumber one.`);
  }

  for (const file of headFiles) {
    const version = versionOf(file);
    if (!version || base.has(file)) continue;
    if (version <= latest) {
      problems.push(`${file} is numbered at or below main's latest (${latest}). Renumber it above ${latest} (same SQL), or production's deploy will refuse it.`);
    }
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ref = process.argv[2] ?? 'origin/main';
  const baseFiles = execFileSync('git', ['ls-tree', '--name-only', `${ref}:${DIR}`], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const headFiles = readdirSync(DIR);
  const problems = migrationProblems(baseFiles, headFiles);
  if (problems.length) {
    console.error(`Migration numbers (against ${ref}):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(`Migration numbers OK against ${ref}.`);
}
