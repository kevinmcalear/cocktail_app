// Tags every older venue logo with its edge (../_shared/logoEdge.ts), so
// phones draw a logo on a flat colour inside a tile of that colour instead of
// with its white (or black) square showing.
//
// upload-bar-logo names each new logo with its edge. Logos stored before it,
// and every seeded bar picture, don't say, and only the web can read their
// pixels. This reads each one once and puts the same tag in its URL's
// fragment ("…/logo.png#effffff", "#clear", "#full"), which logoEdgeFromUrl
// reads. No file is copied or changed: a fragment never reaches the server.
// Columns: bars.logo_url, and profiles.avatar_url for bar pages.
// (bars.icon_url isn't drawn by LogoImage: venue-app pads it itself.)
//
// Dry run by default (prints counts, writes nothing); --apply writes.
// Local stack by default (reads `supabase status`):
//   npx -y deno@2 run -A supabase/functions/_scripts/backfill-logo-edges.ts [--apply] [--limit N]
// Production only with --prod, and --apply only with Kevin's OK:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx -y deno@2 run -A supabase/functions/_scripts/backfill-logo-edges.ts --prod [--apply]
import { parseArgs } from "jsr:@std/cli@1/parse-args";
import { createClient } from "npm:@supabase/supabase-js@2";

import { decodePixels } from "../_shared/decodeImage.ts";
import { decodableSize } from "../_shared/imageSize.ts";
import { type LogoEdge, logoEdge, logoEdgeFromUrl, logoFileTag, logoUrlWithEdge } from "../_shared/logoEdge.ts";
import { isLocalSupabaseUrl } from "../_shared/localUrl.ts";

const args = parseArgs(Deno.args, { boolean: ["apply", "prod"], string: ["limit", "concurrency"] });
/** The same cap as upload-bar-logo. */
const MAX_BYTES = 5 * 1024 * 1024;
const PAGE = 1000;
const COLUMNS = [
  { table: "bars", column: "logo_url", where: null },
  { table: "profiles", column: "avatar_url", where: ["kind", "bar"] },
] as const;

function target(): { url: string; key: string } {
  if (args.prod) {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("--prod needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    return { url, key };
  }
  const out = new Deno.Command("supabase", { args: ["status", "-o", "json"], stderr: "null" }).outputSync();
  const status = JSON.parse(new TextDecoder().decode(out.stdout) || "{}");
  if (!status.API_URL || !isLocalSupabaseUrl(`${status.API_URL}/`)) {
    throw new Error(`Refusing to run on ${status.API_URL ?? "no stack"}: only a local stack, unless --prod is passed.`);
  }
  return { url: status.API_URL, key: status.SERVICE_ROLE_KEY };
}

const { url, key } = target();
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
console.error(`${args.apply ? "Tagging" : "Dry run (add --apply to write)"}: logos on ${new URL(url).host}`);

type Row = { table: string; column: string; id: string; url: string };

// Every untagged logo, grouped by URL so a shared file is read once.
const byUrl = new Map<string, Row[]>();
let alreadyTagged = 0;
for (const { table, column, where } of COLUMNS) {
  for (let after = "00000000-0000-0000-0000-000000000000"; ; ) {
    let query = admin.from(table).select(`id, ${column}`).not(column, "is", null).gt("id", after).order("id").limit(PAGE);
    if (where) query = query.eq(where[0], where[1]);
    const { data, error } = await query;
    if (error) throw error;
    const rows = data as unknown as Record<string, string>[];
    for (const row of rows) {
      const logo = row[column];
      if (logoEdgeFromUrl(logo)) {
        alreadyTagged++;
        continue;
      }
      const list = byUrl.get(logo) ?? [];
      list.push({ table, column, id: row.id, url: logo });
      byUrl.set(logo, list);
    }
    if (rows.length < PAGE) break;
    after = rows[rows.length - 1].id;
  }
}

/** A logo's edge from its pixels, as upload-bar-logo reads it, or why it couldn't. */
async function readEdge(logo: string): Promise<LogoEdge | string> {
  try {
    let res = await fetch(logo, { signal: AbortSignal.timeout(20_000) });
    // Storage rate-limits a burst of reads (429): wait and ask again.
    for (let attempt = 1; (res.status === 429 || res.status >= 500) && attempt <= 5; attempt++) {
      await res.body?.cancel();
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      res = await fetch(logo, { signal: AbortSignal.timeout(20_000) });
    }
    if (!res.ok) return `HTTP ${res.status}`;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length > MAX_BYTES) return "over 5 MB";
    if (!decodableSize(bytes)) return "not a PNG, JPEG or GIF up to 4096 px";
    const pixels = await decodePixels(bytes.buffer);
    return pixels ? logoEdge(pixels.rgba, pixels.width, pixels.height) : "not a readable image";
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

const todo = [...byUrl.keys()].slice(0, args.limit ? Number(args.limit) : Infinity);
const counts = { clear: 0, solid: 0, busy: 0, unreadable: 0 };
const solidColours = new Map<string, number>();
const written = { rows: 0, skipped: 0 };
const failures: string[] = [];

async function one(logo: string) {
  const edge = await readEdge(logo);
  if (typeof edge === "string") {
    counts.unreadable++;
    failures.push(`${edge}: ${logo}`);
    return;
  }
  counts[edge.kind]++;
  if (edge.kind === "solid") solidColours.set(edge.color, (solidColours.get(edge.color) ?? 0) + 1);
  if (!args.apply) return;
  const tagged = logoUrlWithEdge(logo, edge);
  for (const row of byUrl.get(logo)!) {
    // Only while the row still holds the URL that was read, so a logo changed meanwhile is left alone.
    const { data, error } = await admin.from(row.table).update({ [row.column]: tagged }).eq("id", row.id).eq(row.column, row.url).select("id");
    if (error) failures.push(`write ${row.table}.${row.column} ${row.id}: ${error.message}`);
    else if (data.length) written.rows++;
    else written.skipped++;
  }
}

// Four at a time: reads are public files, and writes are one small update each.
const workers = Number(args.concurrency ?? 4);
let next = 0;
await Promise.all(
  Array.from({ length: workers }, async () => {
    while (next < todo.length) await one(todo[next++]);
  }),
);

for (const failure of failures) console.error(failure);
const topSolid = [...solidColours].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, n]) => `${logoFileTag({ kind: "solid", color: c })} x${n}`);
console.log(JSON.stringify({
  apply: args.apply,
  alreadyTagged,
  untaggedRows: [...byUrl.values()].reduce((n, rows) => n + rows.length, 0),
  untaggedLogos: byUrl.size,
  read: todo.length,
  ...counts,
  topSolid,
  ...(args.apply ? written : {}),
}, null, 2));
