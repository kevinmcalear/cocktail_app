// Puts the company logos in supabase/seeds/maker-logos.json on their pages:
// each file goes to the avatars bucket (makers/, or venues/ for a bar page, as
// bar logos do) and becomes the page's avatar_url where it has none. The
// files aren't in the repo, like bar logos: pass the folder of rendered PNGs.
// Each is the company's own mark from its own site (the manifest cites it),
// scaled onto a square of its own background, never redrawn; the name carries
// that background as the edge tag LogoImage reads (logoEdgeFromUrl).
//
// Local stack by default (reads `supabase status`), dry run unless --apply:
//   node scripts/maker-logos.mjs --dir <folder>            what it would do
//   node scripts/maker-logos.mjs --dir <folder> --apply    upload and set
// Production only after Kevin's OK, with SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY in the environment:
//   node scripts/maker-logos.mjs --dir <folder> --prod --apply
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { createClient } from '@supabase/supabase-js';

export const MANIFEST = 'supabase/seeds/maker-logos.json';
/** "<handle>.e1a2b3c.png": the page's handle, then its background colour. */
export const FILE_NAME = /^([a-z0-9][a-z0-9._-]*)\.e[0-9a-f]{6}\.png$/;

/** Where a page's logo lives in the avatars bucket. */
export const bucketPath = (kind, file) => `${kind === 'bar' ? 'venues' : 'makers'}/${file}`;

async function main() {
  const { values: args } = parseArgs({ options: { dir: { type: 'string' }, apply: { type: 'boolean' }, prod: { type: 'boolean' } } });
  if (!args.dir) throw new Error('Pass --dir <folder of rendered logos>.');
  let url, key;
  if (args.prod) {
    url = process.env.SUPABASE_URL;
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('--prod needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  } else {
    const status = JSON.parse(execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
    url = status.API_URL;
    key = status.SERVICE_ROLE_KEY;
    if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) throw new Error(`Not a local stack: ${url}`);
  }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { logos } = JSON.parse(readFileSync(MANIFEST, 'utf8'));

  const { data: pages, error } = await db.from('profiles').select('id, handle, kind, avatar_url').in('handle', logos.map((l) => l.handle));
  if (error) throw error;
  const byHandle = new Map(pages.map((p) => [p.handle, p]));
  const counts = { set: 0, has_logo: 0, no_page: 0 };
  for (const logo of logos) {
    const page = byHandle.get(logo.handle);
    if (!page) { counts.no_page++; console.log(`no page   ${logo.handle}`); continue; }
    if (page.avatar_url) { counts.has_logo++; continue; }
    const file = join(args.dir, logo.file);
    if (!existsSync(file)) throw new Error(`Missing file ${file}`);
    const path = bucketPath(page.kind, logo.file);
    console.log(`${args.apply ? 'set' : 'would set'} ${logo.handle} -> avatars/${path}`);
    counts.set++;
    if (!args.apply) continue;
    const up = await db.storage.from('avatars').upload(path, readFileSync(file), { contentType: 'image/png', upsert: true });
    if (up.error) throw new Error(`${logo.handle}: ${up.error.message}`);
    const publicUrl = db.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    const set = await db.from('profiles').update({ avatar_url: publicUrl }).eq('id', page.id).is('avatar_url', null);
    if (set.error) throw new Error(`${logo.handle}: ${set.error.message}`);
  }
  console.log(JSON.stringify(counts));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
