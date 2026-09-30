// Attach licensed hero photos to shared catalog items (bar_id IS NULL).
//
// Generics: Wikimedia Commons via photo_query (reuse-allowed license only).
// Products: Commons via image_query only when the file title clearly names the
// bottle/pack and the license allows reuse. No shop/Bing/Google scraping.
// Complex house preps: skipped (no obvious pack shot).
//
// Local stack only by default (reads `supabase status`):
//   node scripts/catalog-photos.mjs                 # resolve map + upload/link
//   node scripts/catalog-photos.mjs --resolve        # write photo map only
//   node scripts/catalog-photos.mjs --apply          # upload/link from the map
//   node scripts/catalog-photos.mjs --limit 20
//
// The photo map is metadata only (no binaries). Re-runs skip items that already
// have a non-generated hero. Production upload waits for --remote + Kevin's OK.
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const DIR = 'supabase/seeds/catalog';
const MAP = 'supabase/seeds/catalog-photos.json';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const UA = 'CocktailAppCatalogPhotos/0.1 (catalog seed; https://github.com/kevinmcalear/cocktail_app)';
const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
const MAX_BYTES = 12 * 1024 * 1024;

const STOP = new Set([
  'aged', 'ale', 'amber', 'american', 'beer', 'blanc', 'blanco', 'blend', 'bottle', 'bottles',
  'bourbon', 'brandy', 'cask', 'champagne', 'classic', 'cream', 'creamy', 'dark', 'distillery',
  'double', 'draught', 'dry', 'extra', 'fine', 'french', 'fresh', 'fruit', 'gin', 'glass',
  'gold', 'golden', 'irish', 'juice', 'lager', 'light', 'liqueur', 'london', 'malt', 'navy',
  'original', 'pale', 'premium', 'red', 'reserve', 'rose', 'rum', 'rye', 'scotch', 'silver',
  'single', 'sparkling', 'spirit', 'stout', 'strength', 'style', 'syrup', 'tequila', 'triple',
  'vodka', 'white', 'wine', 'with', 'year', 'years', 'young',
]);

export function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function licenseOk(shortName) {
  if (!shortName) return false;
  const n = shortName.toLowerCase().replace(/[_-]+/g, ' ');
  if (/\bnc\b|non commercial|noncommercial|fair use|all rights reserved/.test(n)) return false;
  return /public domain|^pd\b|cc0|creative commons.?zero|cc by\b/.test(n);
}

export function formatCredit(artist, license) {
  const a = stripHtml(artist).split(/\n|;/)[0].trim() || 'Unknown';
  const lic = stripHtml(license).trim() || 'Unknown';
  const suffix = ` / ${lic}`;
  if (`${a}${suffix}`.length <= 120) return `${a}${suffix}`;
  return `${a.slice(0, Math.max(1, 120 - suffix.length)).trimEnd()}${suffix}`.slice(0, 120);
}

export function productTokens(name, maker = null) {
  const raw = `${maker || ''} ${name || ''}`.toLowerCase().split(/[^a-z0-9]+/);
  return [...new Set(raw.filter((w) => w.length >= 4 && !STOP.has(w)))];
}

export function titleMatchesProduct(fileTitle, name, maker = null) {
  const title = String(fileTitle || '').toLowerCase();
  const tokens = productTokens(name, maker);
  return tokens.length > 0 && tokens.some((t) => title.includes(t));
}

export function commonsFilePage(title) {
  const file = String(title || '').replace(/^File:/i, '');
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`;
}

export function cleanDownloadUrl(url) {
  try {
    const u = new URL(url);
    u.search = '';
    return u.toString();
  } catch {
    return url;
  }
}

function key(type, name) {
  return `${type}\0${name.toLocaleLowerCase('en')}`;
}

function loadCatalog() {
  const groups = new Map();
  for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()) {
    for (const row of JSON.parse(readFileSync(join(DIR, file), 'utf8'))) {
      const id = key(row.type, row.name);
      const prev = groups.get(id);
      if (!prev) groups.set(id, { ...row, match: [...new Set([...(row.match || []), row.name])] });
      else prev.match = [...new Set([...(prev.match || []), ...(row.match || []), row.name])];
    }
  }
  return [...groups.values()].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
}

function readMap() {
  try {
    return JSON.parse(readFileSync(MAP, 'utf8'));
  } catch {
    return { photos: [], skipped: [] };
  }
}

function writeMap(map) {
  writeFileSync(MAP, `${JSON.stringify(map, null, 2)}\n`);
}

async function commonsSearch(query, limit = 8) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${query}`,
    gsrnamespace: '6',
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata',
    iiextmetadatafilter: 'LicenseShortName|Artist|Attribution|Credit',
  });
  const res = await fetch(`${COMMONS}?${params}`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Commons HTTP ${res.status}`);
  const data = await res.json();
  return Object.values(data.query?.pages || {})
    .map((page) => {
      const info = page.imageinfo?.[0];
      if (!info?.url || !info.mime?.startsWith('image/')) return null;
      const meta = info.extmetadata || {};
      return {
        title: page.title,
        url: cleanDownloadUrl(info.url),
        mime: info.mime,
        width: info.width || 0,
        height: info.height || 0,
        size: info.size || 0,
        license: meta.LicenseShortName?.value || '',
        artist: meta.Attribution?.value || meta.Artist?.value || meta.Credit?.value || '',
      };
    })
    .filter(Boolean);
}

function pickCandidate(row, candidates) {
  const ranked = candidates
    .filter((c) => licenseOk(c.license))
    .filter((c) => c.size <= MAX_BYTES)
    .filter((c) => !c.width || (c.width >= 400 && c.width <= 6000))
    .filter((c) => row.role !== 'product' || titleMatchesProduct(c.title, row.name, row.maker));
  return ranked[0] || null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadBytes(url, attempt = 0) {
  let res;
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
  } catch (err) {
    if (attempt < 3) {
      await sleep(1000 * (attempt + 1));
      return downloadBytes(url, attempt + 1);
    }
    throw err;
  }
  if (res.status === 429 && attempt < 5) {
    await sleep(1500 * (attempt + 1));
    return downloadBytes(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function resolvePhotos({ limit, only }) {
  const rows = loadCatalog().filter((row) => {
    if (only === 'generics') return row.role === 'generic';
    if (only === 'products') return row.role === 'product';
    return row.role === 'generic' || row.role === 'product';
  });
  const map = readMap();
  const byKey = new Map(map.photos.map((p) => [`${p.item_type}\0${p.name}`, p]));
  const skipped = [];
  let resolved = 0;
  let examined = 0;

  for (const row of rows) {
    const id = `${row.type}\0${row.name}`;
    if (byKey.has(id)) continue;
    if (examined >= limit) break;
    examined++;

    if (row.role === 'complex') {
      skipped.push({ item_type: row.type, name: row.name, reason: 'complex' });
      continue;
    }
    const query = row.role === 'generic' ? row.photo_query : row.image_query;
    if (!query) {
      skipped.push({ item_type: row.type, name: row.name, reason: 'no_query' });
      continue;
    }

    let candidates = [];
    try {
      candidates = await commonsSearch(query);
    } catch (err) {
      skipped.push({ item_type: row.type, name: row.name, reason: `commons_error:${err.message}` });
      await sleep(300);
      continue;
    }
    const pick = pickCandidate(row, candidates);
    if (!pick) {
      skipped.push({
        item_type: row.type,
        name: row.name,
        reason: row.role === 'product' ? 'no_licensed_match' : 'no_licensed_commons',
      });
      await sleep(200);
      continue;
    }

    const photo = {
      item_type: row.type,
      name: row.name,
      role: row.role,
      query,
      file_title: pick.title,
      source_url: commonsFilePage(pick.title),
      download_url: pick.url,
      mime: pick.mime,
      credit: formatCredit(pick.artist, pick.license),
    };
    byKey.set(id, photo);
    resolved++;
    if (resolved % 25 === 0) console.log(`resolved ${resolved} (examined ${examined})`);
    await sleep(200);
  }

  // Keep prior skips that are still relevant; replace with this run's skips for examined rows.
  const examinedKeys = new Set(
    rows.slice(0, examined).map((r) => `${r.type}\0${r.name}`),
  );
  const priorSkips = (map.skipped || []).filter((s) => !examinedKeys.has(`${s.item_type}\0${s.name}`));
  const out = {
    photos: [...byKey.values()].sort((a, b) => a.item_type.localeCompare(b.item_type) || a.name.localeCompare(b.name)),
    skipped: [...priorSkips, ...skipped].sort((a, b) => a.name.localeCompare(b.name)),
  };
  writeMap(out);
  console.log(`Map ${MAP}: ${out.photos.length} photos, ${out.skipped.length} skipped ( +${resolved} this run )`);
  return out;
}

function localTarget() {
  const status = JSON.parse(
    execSync('supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
  );
  if (!LOCAL.test(status.API_URL)) {
    throw new Error(`Refusing a non-local API without --remote: ${status.API_URL}`);
  }
  return {
    url: status.API_URL,
    key: status.SERVICE_ROLE_KEY,
    db: status.DB_URL,
  };
}

function remoteTarget() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db = process.env.SUPABASE_DB_URL;
  if (!url || !key || !db) {
    throw new Error('--remote needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_URL.');
  }
  if (LOCAL.test(url)) throw new Error('--remote pointed at a local URL; drop --remote.');
  return { url, key, db };
}

async function findSharedItem(client, itemType, name, aliases) {
  const names = [...new Set([name, ...(aliases || [])])];
  const { rows } = await client.query(
    `SELECT id, name
       FROM public.items
      WHERE bar_id IS NULL
        AND item_type::text = $1
        AND lower(name) = ANY($2::text[])
      ORDER BY (name = $3) DESC, created_at
      LIMIT 1`,
    [itemType, names.map((n) => n.toLocaleLowerCase('en')), name],
  );
  return rows[0] || null;
}

async function hasRealHero(client, itemId) {
  const { rows } = await client.query(
    `SELECT 1
       FROM public.item_images ii
       JOIN public.images i ON i.id = ii.image_id
      WHERE ii.item_id = $1
        AND coalesce(ii.angle, 'hero') = 'hero'
        AND NOT coalesce(ii.is_generated, i.is_generated)
      LIMIT 1`,
    [itemId],
  );
  return rows.length > 0;
}

function extFor(mime, url) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  if (/\.png(?:$|\?)/i.test(url)) return 'png';
  if (/\.webp(?:$|\?)/i.test(url)) return 'webp';
  return 'jpg';
}

async function applyPhotos({ limit, remote }) {
  const target = remote ? remoteTarget() : localTarget();
  const map = readMap();
  const catalog = new Map(loadCatalog().map((r) => [`${r.type}\0${r.name}`, r]));
  const storage = createClient(target.url, target.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from('drinks');
  const client = new pg.Client({ connectionString: target.db });
  await client.connect();

  const counts = { attached: 0, skippedExisting: 0, missingItem: 0, failed: 0 };
  const failures = [];

  try {
    await client.query(`SET "app.image_worker" = 'on'`);
    // ponytail: palette HTTP-on-insert wedged local Docker at ~600 rows; backfill later.
    await client.query(`ALTER TABLE public.images DISABLE TRIGGER images_request_palette`);
    let n = 0;
    for (const photo of map.photos) {
      if (n >= limit) break;
      n++;
      const row = catalog.get(`${photo.item_type}\0${photo.name}`);
      if (!row) {
        counts.missingItem++;
        continue;
      }
      const item = await findSharedItem(client, photo.item_type, photo.name, row.match);
      if (!item) {
        counts.missingItem++;
        continue;
      }
      if (await hasRealHero(client, item.id)) {
        counts.skippedExisting++;
        continue;
      }

      try {
        if ((counts.attached + counts.failed) % 25 === 0) console.log(`… ${photo.name}`);
        const bytes = await downloadBytes(photo.download_url);
        if (bytes.length > MAX_BYTES) throw new Error(`too large (${bytes.length})`);
        const ext = extFor(photo.mime, photo.download_url);
        const hash = createHash('sha1').update(bytes).digest('hex').slice(0, 12);
        const path = `catalog/${item.id}/hero-${hash}.${ext}`;
        const contentType = photo.mime || (ext === 'jpg' ? 'image/jpeg' : `image/${ext}`);
        const { error: upErr } = await storage.upload(path, bytes, { contentType, upsert: false });
        if (upErr && !/already exists|Duplicate/i.test(upErr.message)) throw upErr;
        const publicUrl = storage.getPublicUrl(path).data.publicUrl;

        const { rows: imgRows } = await client.query(
          `INSERT INTO public.images (url, is_generated, credit, source_url)
           VALUES ($1, false, $2, $3)
           RETURNING id`,
          [publicUrl, photo.credit, photo.source_url],
        );
        await client.query(
          `INSERT INTO public.item_images (item_id, image_id, angle, sort_order)
           VALUES ($1, $2, 'hero', 0)`,
          [item.id, imgRows[0].id],
        );
        counts.attached++;
        if (counts.attached % 25 === 0) console.log(`attached ${counts.attached}`);
        await sleep(100);
      } catch (err) {
        counts.failed++;
        failures.push(`${photo.name}: ${err.message || err}`);
        await sleep(300);
      }
    }
  } finally {
    await client.query(`ALTER TABLE public.images ENABLE TRIGGER images_request_palette`).catch(() => {});
    await client.query(`RESET "app.image_worker"`).catch(() => {});
    await client.end();
  }

  console.log(`Apply on ${new URL(target.url).host}:`, counts);
  if (failures.length) {
    console.log('Failures (first 20):');
    for (const line of failures.slice(0, 20)) console.log(`  ${line}`);
  }
  return counts;
}

async function main() {
  const { values: args } = parseArgs({
    options: {
      resolve: { type: 'boolean', default: false },
      apply: { type: 'boolean', default: false },
      remote: { type: 'boolean', default: false },
      limit: { type: 'string' },
      only: { type: 'string' },
    },
  });
  const limit = args.limit == null ? Infinity : Number(args.limit);
  if (args.limit != null && (!Number.isFinite(limit) || limit < 0)) throw new Error('--limit must be a number');
  if (args.remote && !args.apply && args.resolve) {
    throw new Error('--remote is only for --apply (never resolve against production).');
  }

  const doResolve = args.resolve || (!args.resolve && !args.apply);
  const doApply = args.apply || (!args.resolve && !args.apply);

  if (doResolve) await resolvePhotos({ limit, only: args.only });
  if (doApply) {
    if (args.remote) {
      console.log('Remote apply: uploading to the linked project. Kevin must have said OK.');
    }
    await applyPhotos({ limit, remote: !!args.remote });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
