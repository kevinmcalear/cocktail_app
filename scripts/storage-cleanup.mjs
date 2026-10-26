// Removes the picture files queued in private.storage_cleanup (a deleted
// venue's logo, menu covers, drink pictures). public.storage_cleanup_batch
// drops any file a row points at again, so only unused files are removed.
//
// Local stack by default (reads `supabase status`):
//   node scripts/storage-cleanup.mjs [--dry-run]
//
// --dry-run removes no files, but still lets the queue drop files that are
// in use again (that is what storage_cleanup_batch does first).
//
// Production only on purpose, with Kevin's OK:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/storage-cleanup.mjs --remote
//
// ponytail: run by hand (or after a venue is deleted). Upgrade path: a
// scheduled edge function that runs the same loop.
import { execSync } from 'node:child_process';
import { parseArgs } from 'node:util';

import { createClient } from '@supabase/supabase-js';

const { values: args } = parseArgs({
  options: {
    remote: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});

const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
const BATCH = 100;

function target() {
  if (args.remote) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('--remote needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    return { url, key };
  }
  const status = JSON.parse(
    execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  );
  if (!LOCAL.test(status.API_URL)) {
    throw new Error(`Refusing to clean a non-local API without --remote: ${status.API_URL}`);
  }
  return { url: status.API_URL, key: status.SERVICE_ROLE_KEY };
}

const { url, key } = target();
const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let removed = 0;
for (;;) {
  const { data: files, error } = await service.rpc('storage_cleanup_batch', { p_limit: BATCH });
  if (error) throw error;
  if (!files.length) break;
  if (args['dry-run']) {
    for (const f of files) console.log(`would remove ${f.bucket_id}/${f.name}`);
    break;
  }
  const byBucket = Map.groupBy(files, (f) => f.bucket_id);
  for (const [bucket, rows] of byBucket) {
    // A file already gone counts as removed: remove() skips missing names.
    const { error: removeError } = await service.storage.from(bucket).remove(rows.map((f) => f.name));
    if (removeError) throw removeError;
  }
  const { error: doneError } = await service.rpc('storage_cleanup_done', { p_ids: files.map((f) => f.id) });
  if (doneError) throw doneError;
  removed += files.length;
}
console.log(`${args['dry-run'] ? 'Dry run on' : `Removed ${removed} files from`} ${new URL(url).host}`);
