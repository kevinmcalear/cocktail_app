// Reads brightness and quiet room (images.brightness, text_zone,
// 20261206150000) for photos from before the scan at upload, with the same
// reading the phone does (supabase/functions/_shared/photoLayout.ts). Writes
// nothing else, and skips drawings and cut-outs: they sit on paper.
//
// Local stack by default (reads `supabase status`):
//   node --import tsx scripts/backfill-photo-layout.ts [--dry-run] [--force] [--limit N]
//
// Production is a hand step, with Kevin's OK, after the migration is in:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node --import tsx scripts/backfill-photo-layout.ts --remote
//
// --force reads every photo again, not just the ones not read yet.
import { execSync } from 'node:child_process';
import { parseArgs } from 'node:util';

import { createClient } from '@supabase/supabase-js';
import { decode } from 'jpeg-js';

import { isPng, LIGHT_PHOTO } from '../lib/itemImages';
import { thumbUrl } from '../lib/thumbnails';
import { readPhotoLayout, shrinkForLayout } from '../supabase/functions/_shared/photoLayout';

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
    if (!url || !key) throw new Error('--remote needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    return { url, key };
  }
  const status = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  if (!LOCAL.test(status.API_URL)) throw new Error(`Refusing to backfill a non-local API without --remote: ${status.API_URL}`);
  return { url: status.API_URL as string, key: status.SERVICE_ROLE_KEY as string };
}

/** The photo's bytes: its list copy (a JPEG, and plenty for the scan), or the photo itself where there's none. */
async function jpegOf(url: string): Promise<Uint8Array | null> {
  for (const source of [thumbUrl(url), url]) {
    if (!source) continue;
    const res = await fetch(source);
    if (!res.ok) continue;
    const bytes = new Uint8Array(await res.arrayBuffer());
    // "FF D8 FF": anything else (a WebP from elsewhere) keeps a null brightness and a dark page.
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return bytes;
  }
  return null;
}

async function main() {
  const { url, key } = target();
  const limit = args.limit ? Number(args.limit) : Infinity;
  const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  console.log(`Reading photos on ${new URL(url).host}${args.force ? ' (all photos)' : ''}`);

  const counts = { read: 0, room: 0, light: 0, skipped: 0, failed: 0 };
  const failures: string[] = [];
  let lastId = '00000000-0000-0000-0000-000000000000';
  let seen = 0;

  while (seen < limit) {
    let query = service.from('images').select('id, url, is_generated').gt('id', lastId).order('id').limit(Math.min(PAGE, limit - seen));
    if (!args.force) query = query.is('brightness', null);
    const { data: rows, error } = await query;
    if (error) throw error;
    if (rows.length === 0) break;
    lastId = rows[rows.length - 1].id;
    seen += rows.length;

    for (const [index, row] of rows.entries()) {
      process.stdout.write(`\r${seen - rows.length + index + 1} done`);
      if (row.is_generated || isPng(row.url)) {
        counts.skipped++;
        continue;
      }
      if (args['dry-run']) continue;
      try {
        const bytes = await jpegOf(row.url);
        if (!bytes) {
          counts.skipped++;
          continue;
        }
        const { data, width, height } = decode(bytes, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 });
        const small = shrinkForLayout(data, width, height);
        const { brightness, textZone } = readPhotoLayout(small.rgba, small.width, small.height);
        // Only if the row still shows this photo.
        const { error: saveError } = await service
          .from('images')
          .update({ brightness, text_zone: textZone ? { ...textZone } : null })
          .eq('id', row.id)
          .eq('url', row.url);
        if (saveError) throw saveError;
        counts.read++;
        if (textZone) counts.room++;
        if (brightness >= LIGHT_PHOTO) counts.light++;
      } catch (err) {
        counts.failed++;
        failures.push(`${row.id}: ${(err as Error).message}`);
      }
    }
  }

  console.log(`\n${seen} rows: ${counts.read} read (${counts.room} with room, ${counts.light} bright), ${counts.skipped} skipped, ${counts.failed} failed.`);
  if (failures.length) {
    console.log(failures.join('\n'));
    process.exitCode = 1;
  }
}

void main();
