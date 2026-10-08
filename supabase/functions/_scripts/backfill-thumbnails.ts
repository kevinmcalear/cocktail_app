// Makes the list-sized thumbnail (../_shared/thumbnail.ts) for every picture
// in the drinks bucket that doesn't have one yet. New pictures get theirs
// from image-palette as they arrive; this is for the ones from before.
//
// Local stack by default (reads `supabase status`):
//   deno run -A supabase/functions/_scripts/backfill-thumbnails.ts [--dry-run] [--limit N]
// Production, with Kevin's OK:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... deno run -A supabase/functions/_scripts/backfill-thumbnails.ts --remote
//
// Runs here, not in the edge function: decoding a 3000 px photo takes about
// half a second of CPU, and a thousand of them would hit the function's limits.
import { parseArgs } from "jsr:@std/cli@1/parse-args";
import { createClient } from "npm:@supabase/supabase-js@2";

import { decodePixels } from "../_shared/decodeImage.ts";
import { saveThumbnail, thumbPath } from "../_shared/thumbnail.ts";

const args = parseArgs(Deno.args, { boolean: ["remote", "dry-run"], string: ["limit", "concurrency"] });
const STORAGE_PATH = /\/storage\/v1\/object\/public\/drinks\/(.+)$/;
const MAX_BYTES = 12 * 1024 * 1024;
const PAGE = 1000;

function target(): { url: string; key: string } {
  if (args.remote) {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("--remote needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    return { url, key };
  }
  const out = new Deno.Command("supabase", { args: ["status", "-o", "json"], stderr: "null" }).outputSync();
  const status = JSON.parse(new TextDecoder().decode(out.stdout));
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(status.API_URL)) throw new Error(`Not a local stack: ${status.API_URL}`);
  return { url: status.API_URL, key: status.SERVICE_ROLE_KEY };
}

const { url, key } = target();
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// Every picture in the drinks bucket, once (rows can share a file).
const paths = new Set<string>();
for (let after = "00000000-0000-0000-0000-000000000000"; ; ) {
  const { data, error } = await admin.from("images").select("id, url").gt("id", after).order("id").limit(PAGE);
  if (error) throw error;
  for (const row of data) {
    const path = row.url && new URL(row.url).pathname.match(STORAGE_PATH)?.[1];
    if (path && !path.startsWith("thumbs/")) paths.add(decodeURIComponent(path));
  }
  if (data.length < PAGE) break;
  after = data[data.length - 1].id;
}

const limit = args.limit ? Number(args.limit) : Infinity;
const todo = [...paths].slice(0, limit);
const publicUrl = (path: string) => admin.storage.from("drinks").getPublicUrl(path).data.publicUrl;
const counts = { made: 0, had: 0, failed: 0 };
let bytesBefore = 0;
let bytesAfter = 0;

/** Storage shares the database's small connection pool: back off when it's full, never push harder. */
async function retrying<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await work();
    } catch (err) {
      const busy = /too many connections/i.test(err instanceof Error ? err.message : String(err));
      if (!busy || attempt >= 5) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}

async function one(path: string) {
  const head = await fetch(publicUrl(thumbPath(path)), { method: "HEAD" });
  if (head.ok) {
    counts.had++;
    return;
  }
  if (args["dry-run"]) {
    counts.made++;
    return;
  }
  try {
    const blob = await retrying(async () => {
      const { data, error } = await admin.storage.from("drinks").download(path);
      if (error) throw error;
      return data;
    });
    if (blob.size > MAX_BYTES) throw new Error("too large");
    const pixels = await decodePixels(await blob.arrayBuffer());
    if (!pixels) throw new Error("could not decode");
    await retrying(() => saveThumbnail(admin, path, pixels));
    const made = await fetch(publicUrl(thumbPath(path)), { method: "HEAD" });
    bytesBefore += blob.size;
    bytesAfter += Number(made.headers.get("content-length") ?? 0);
    counts.made++;
  } catch (err) {
    counts.failed++;
    console.error(`failed ${path}: ${err instanceof Error ? err.message : err}`);
  }
}

// Two at a time by default: production's connection pool is small (six at once filled it).
const workers = Number(args.concurrency ?? 2);
let next = 0;
await Promise.all(
  Array.from({ length: workers }, async () => {
    while (next < todo.length) await one(todo[next++]);
  }),
);

const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
console.log(JSON.stringify({ pictures: todo.length, ...counts, originalsMB: mb(bytesBefore), thumbnailsMB: mb(bytesAfter), dryRun: !!args["dry-run"] }));
