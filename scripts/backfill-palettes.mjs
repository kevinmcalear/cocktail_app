// Computes the drink-field palette for pictures that don't have one yet, by
// calling the image-palette edge function for each `images` row.
//
// Local stack by default (reads `supabase status`; the edge runtime must be
// running):
//   node scripts/backfill-palettes.mjs [--dry-run] [--force] [--limit N]
//
// Production only on purpose, with Kevin's OK and the function deployed:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... IMAGE_PALETTE_SECRET=... \
//     node scripts/backfill-palettes.mjs --remote
//
// --force recomputes every picture, not just the ones without a palette.
import { execSync } from 'node:child_process';
import { parseArgs } from 'node:util';

import { createClient } from '@supabase/supabase-js';

const { values: args } = parseArgs({
  options: {
    remote: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    limit: { type: 'string' },
  },
});

const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
const PAGE = 500;

function target() {
  if (args.remote) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const secret = process.env.IMAGE_PALETTE_SECRET;
    if (!url || !key || !secret) {
      throw new Error('--remote needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and IMAGE_PALETTE_SECRET.');
    }
    return { url, key, secret };
  }
  const status = JSON.parse(
    execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  );
  if (!LOCAL.test(status.API_URL)) {
    throw new Error(`Refusing to backfill a non-local API without --remote: ${status.API_URL}`);
  }
  return {
    url: status.API_URL,
    key: status.SERVICE_ROLE_KEY,
    // Matches [edge_runtime.secrets] in supabase/config.toml.
    secret: process.env.IMAGE_PALETTE_SECRET ?? 'local-image-palette-secret',
  };
}

const { url, key, secret } = target();
const limit = args.limit ? Number(args.limit) : Infinity;
const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
console.log(`Backfilling palettes on ${new URL(url).host}${args.force ? ' (all pictures)' : ''}`);

// One at a time: parallel calls share an isolate's CPU budget and get cut off.
async function computePalette(imageId, retry = true) {
  const res = await fetch(`${url}/functions/v1/image-palette`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-image-palette-secret': secret },
    body: JSON.stringify({ image_id: imageId, force: args.force }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status >= 500 && retry) return computePalette(imageId, false);
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body.palette;
}

const counts = { coloured: 0, noColour: 0, failed: 0 };
const failures = [];
let lastId = '00000000-0000-0000-0000-000000000000';
let seen = 0;

while (seen < limit) {
  let query = service.from('images').select('id, url').gt('id', lastId).order('id').limit(Math.min(PAGE, limit - seen));
  if (!args.force) query = query.is('palette', null);
  const { data: rows, error } = await query;
  if (error) throw error;
  if (rows.length === 0) break;
  lastId = rows[rows.length - 1].id;
  seen += rows.length;

  if (args['dry-run']) {
    for (const row of rows) console.log(`would compute ${row.id}  ${row.url}`);
    continue;
  }

  for (const [index, row] of rows.entries()) {
    try {
      const palette = await computePalette(row.id);
      if (palette.length) counts.coloured++;
      else counts.noColour++;
    } catch (err) {
      counts.failed++;
      failures.push(`${row.id}: ${err.message}`);
    }
    process.stdout.write(`\r${seen - rows.length + index + 1} done`);
  }
}

if (args['dry-run']) {
  console.log(`${seen} pictures would be computed.`);
  process.exit(0);
}
console.log(
  `\n${seen} pictures: ${counts.coloured} with a palette, ${counts.noColour} with no colour, ${counts.failed} failed.`
);
if (failures.length) {
  console.log(failures.join('\n'));
  process.exitCode = 1;
}
