// Splits supabase/tests across CI's parallel "Security tests" shards, each on
// its own runner with its own local stack.
//
//   node scripts/security-shard.mjs         every file (the default, 1/1)
//   SECURITY_SHARD=2/3 node scripts/...     the files for shard 2 of 3
//
// Prints the files, space-separated, for `npm run test:security` to pass to
// node --test. Test file names have no spaces.
// Two files are most of the suite's time, so the split is by measured seconds,
// not by count: each file goes to the shard with the least time so far,
// slowest first.
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TESTS = 'supabase/tests';

// ponytail: hand-measured seconds on CI's faster runners (22 to 23 Oct 2026;
// the whole suite was 975s in one job). A file that slows down still runs,
// just less evenly; the upgrade path is reading durations from a JUnit report
// of the last run.
export const SECONDS = {
  'bottle-catalog.test.mjs': 431, // re-runs the ingredient tree migrations twice
  'db-indexes.test.mjs': 227, // compares search_bar_drinks old and new for every reader
};
const OTHER = 1.8; // the other 134 files took about 240s together

/** The test files for shard `index` (1-based) of `total`. */
export function shard(files, index, total) {
  for (const f of Object.keys(SECONDS)) {
    if (!files.includes(f)) throw new Error(`${TESTS}/${f} is gone: update SECONDS in scripts/security-shard.mjs`);
  }
  const load = Array(total).fill(0);
  const out = Array.from({ length: total }, () => []);
  const weight = (f) => SECONDS[f] ?? OTHER;
  const order = [...files].sort((a, b) => weight(b) - weight(a) || a.localeCompare(b));
  for (const f of order) {
    const i = load.indexOf(Math.min(...load));
    load[i] += weight(f);
    out[i].push(f);
  }
  return out[index - 1].sort();
}

export function parse(value = '1/1') {
  const m = /^(\d+)\/(\d+)$/.exec(value);
  const [index, total] = m ? [Number(m[1]), Number(m[2])] : [];
  if (!m || index < 1 || index > total) throw new Error(`SECURITY_SHARD must look like 2/3, not "${value}"`);
  return { index, total };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { index, total } = parse(process.env.SECURITY_SHARD || undefined);
  const files = readdirSync(join(ROOT, TESTS)).filter((f) => f.endsWith('.test.mjs'));
  console.log(shard(files, index, total).map((f) => `${TESTS}/${f}`).join(' '));
}
