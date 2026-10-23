// A database built on main, reused by PRs so the security shards don't replay
// every migration (most of each shard's time).
//
//   node scripts/db-snapshot.mjs list > migrations.sha256
//   node scripts/db-snapshot.mjs check migrations.sha256
//
// On a push to main, CI replays every migration from scratch as always, then
// saves the built database with `list` (each migration's name and hash). A PR
// loads it and applies only its own new migrations, but only if `check` passes:
// every migration in the snapshot is still in this checkout, unchanged, and
// each new one sorts after the snapshot's latest. Anything else (an edited,
// removed or renumbered migration) replays from scratch, so the database a PR
// is tested on is the one a fresh replay of its migrations builds. Main's own
// runs never reuse a snapshot, so every merge still proves a full replay.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = 'supabase/migrations';

/** name -> sha256 of each migration file in `dir`. */
export function hashes(dir = DIR) {
  return Object.fromEntries(
    readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => [f, createHash('sha256').update(readFileSync(join(dir, f))).digest('hex')])
  );
}

export const format = (h) => Object.entries(h).map(([f, sha]) => `${sha}  ${f}`).join('\n') + '\n';

export const parse = (text) =>
  Object.fromEntries(
    text
      .split('\n')
      .filter(Boolean)
      .map((l) => l.split(/\s+/))
      .map(([sha, f]) => [f, sha])
  );

/** Why the snapshot can't be reused for `head`, or null when it can. */
export function mismatch(snapshot, head) {
  const names = Object.keys(snapshot);
  if (!names.length) return 'the snapshot lists no migrations';
  for (const f of names) {
    if (!(f in head)) return `${f} is in the snapshot but not in this checkout`;
    if (head[f] !== snapshot[f]) return `${f} changed since the snapshot`;
  }
  const latest = names.sort().at(-1);
  const early = Object.keys(head).find((f) => !(f in snapshot) && f < latest);
  return early ? `${early} sorts before the snapshot's latest (${latest})` : null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, file] = process.argv.slice(2);
  if (cmd === 'list') {
    process.stdout.write(format(hashes()));
  } else if (cmd === 'check' && file) {
    const why = mismatch(parse(readFileSync(file, 'utf8')), hashes());
    if (why) {
      console.log(`Replaying every migration: ${why}.`);
      process.exit(1);
    }
    console.log('Reusing main\'s database; applying only the new migrations.');
  } else {
    console.error('usage: node scripts/db-snapshot.mjs list | check <file>');
    process.exit(2);
  }
}
