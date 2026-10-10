import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { createClient } from "npm:@supabase/supabase-js@2";

import { requireUser } from "../_shared/auth.ts";
import { HttpError, requireUuid, serveJson } from "../_shared/http.ts";
import { guessKind, looksInternal, readCalendar, type CalendarEvent } from "../_shared/icsRead.ts";
import { LinkError, openLink, readCapped } from "../_shared/linkRead.ts";
import { isLocalStack, LOCAL_CALENDAR_SYNC_SECRET } from "../_shared/localStack.ts";

const FN = "sync-calendar";
/** Events from six hours ago (tonight's, still on) to a month out. */
const BEHIND_MS = 6 * 3600 * 1000;
const AHEAD_MS = 31 * 24 * 3600 * 1000;
/** A calendar synced this recently is left alone by the cron tick. */
const FRESH_MS = 150 * 60 * 1000;
/** Sources per cron tick, one after another. */
const PER_TICK = 40;

/**
 * This week from a calendar link (20261012610000_calendar_sources.sql).
 *
 *   { url, bar_id, preview: true }  signed in, at a venue where you build
 *                                   menus: what the link holds, nothing saved
 *   { source_id }                   signed in, same rule: bring that calendar
 *                                   in now (the app calls this after adding it)
 *   {} + x-calendar-sync-secret     the cron tick: every calendar not synced
 *                                   in the last couple of hours
 *
 * A sync updates each occurrence in place (name, times, notes, link), drops
 * future ones the calendar no longer has, and keeps what the team changed.
 */
serveJson(FN, async (req) => {
  if (req.headers.get("x-calendar-sync-secret") !== null) {
    if (!workerAuthorized(req)) throw new HttpError(401, "Not allowed.");
    return await syncDue(serviceClient());
  }

  const caller = await requireUser(req);
  const body = await req.json().catch(() => ({}));

  if (body?.preview) {
    const barId = requireUuid(body.bar_id, "bar_id");
    await requireBuilder(caller.userClient, barId);
    const now = Date.now();
    const events = await readFeed(String(body.url ?? ""), now);
    return {
      events: events.map((e) => {
        const kind = guessKind(e.name, e.description);
        return { uid: e.uid, name: e.name, starts_at: e.startsAt, ends_at: e.endsAt, kind, internal: kind === "private" || looksInternal(e.name), ticket_url: e.url };
      }),
    };
  }

  const sourceId = requireUuid(body?.source_id, "source_id");
  // Row-level security: only a member who builds menus there sees the source.
  const { data: source, error } = await caller.userClient.from("calendar_sources").select("id").eq("id", sourceId).maybeSingle();
  if (error) throw error;
  if (!source) throw new HttpError(404, "That calendar isn't at your venue.");
  return await syncOne(caller.admin, sourceId);
});

function workerAuthorized(req: Request): boolean {
  const expected = Deno.env.get("CALENDAR_SYNC_SECRET") || (isLocalStack() ? LOCAL_CALENDAR_SYNC_SECRET : "");
  const given = req.headers.get("x-calendar-sync-secret") ?? "";
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false } });
}

async function requireBuilder(client: SupabaseClient, barId: string): Promise<void> {
  const { data, error } = await client.rpc("my_capabilities", { p_bar_id: barId });
  if (error) throw error;
  if (!Array.isArray(data) || !data.includes("menus")) throw new HttpError(403, "Only people who build menus at this venue can bring in a calendar.");
}

async function resolve(host: string): Promise<string[]> {
  if (typeof Deno.resolveDns !== "function") return [];
  const [a, aaaa] = await Promise.all([
    Deno.resolveDns(host, "A").catch(() => [] as string[]),
    Deno.resolveDns(host, "AAAA").catch(() => [] as string[]),
  ]);
  return [...a, ...aaaa];
}

/** webcal:// is https:// for a calendar app. */
export const feedUrl = (raw: string) => raw.trim().replace(/^webcals?:\/\//i, "https://");

async function readFeed(raw: string, now: number): Promise<CalendarEvent[]> {
  const url = feedUrl(raw);
  if (!url || url.length > 1000) throw new HttpError(400, "Paste the calendar's link.");
  try {
    const { res } = await openLink(url, { fetch, resolve }, "text/calendar,text/plain;q=0.9,*/*;q=0.1", " Check the calendar is public.");
    const text = new TextDecoder().decode(await readCapped(res));
    return readCalendar(text, now - BEHIND_MS, now + AHEAD_MS);
  } catch (e) {
    if (e instanceof LinkError) throw new HttpError(400, e.message);
    if (e instanceof Error && /isn't a calendar/.test(e.message)) throw new HttpError(400, "That link isn't a calendar. In Google Calendar, use the public address in iCal format.");
    throw e;
  }
}

interface Source {
  id: string;
  bar_id: string;
  url: string;
  starts_public: boolean;
  skipped_uids: string[];
}

async function syncDue(admin: SupabaseClient) {
  const stale = new Date(Date.now() - FRESH_MS).toISOString();
  const { data, error } = await admin
    .from("calendar_sources")
    .select("id")
    .or(`last_synced_at.is.null,last_synced_at.lt.${stale}`)
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(PER_TICK);
  if (error) throw error;
  let synced = 0;
  for (const { id } of data ?? []) {
    await syncOne(admin, id).then(() => synced++, () => {});
  }
  return { synced };
}

async function syncOne(admin: SupabaseClient, sourceId: string) {
  const { data: source, error } = await admin.from("calendar_sources").select("id, bar_id, url, starts_public, skipped_uids").eq("id", sourceId).single<Source>();
  if (error) throw error;
  const now = Date.now();
  let events: CalendarEvent[];
  try {
    events = await readFeed(source.url, now);
  } catch (e) {
    const message = e instanceof Error ? e.message : "The calendar didn't open.";
    await admin.from("calendar_sources").update({ last_error: message, last_synced_at: new Date().toISOString() }).eq("id", source.id);
    throw e;
  }
  const skipped = new Set(source.skipped_uids);
  const wanted = events.filter((e) => !skipped.has(e.uid));

  const { data: existing, error: readError } = await admin.from("events").select("id, external_uid, starts_at").eq("source_id", source.id);
  if (readError) throw readError;
  const byUid = new Map((existing ?? []).map((e) => [e.external_uid as string, e]));

  let added = 0;
  let changed = 0;
  for (const e of wanted) {
    const fields = { name: e.name, starts_at: e.startsAt, ends_at: e.endsAt, description: e.description, ticket_url: e.url };
    const had = byUid.get(e.uid);
    if (had) {
      const { error: upError } = await admin.from("events").update(fields).eq("id", had.id);
      if (!upError) changed++;
      continue;
    }
    const kind = guessKind(e.name, e.description);
    const row = { ...fields, bar_id: source.bar_id, source_id: source.id, external_uid: e.uid, kind, is_public: source.starts_public && kind !== "private" && !looksInternal(e.name) };
    let { error: insError } = await admin.from("events").insert(row);
    // The content filter refused it in public: bring it in for the team instead.
    if (insError?.code === "P0001" && row.is_public) ({ error: insError } = await admin.from("events").insert({ ...row, is_public: false }));
    if (!insError) added++;
  }

  // Future events the calendar dropped (or the team skipped) go; past ones stay as a record.
  const keep = new Set(wanted.map((e) => e.uid));
  const gone = (existing ?? []).filter((e) => !keep.has(e.external_uid as string) && Date.parse(e.starts_at as string) > now).map((e) => e.id);
  if (gone.length) await admin.from("events").delete().in("id", gone);

  await admin.from("calendar_sources").update({ last_error: null, last_synced_at: new Date().toISOString() }).eq("id", source.id);
  return { added, changed, removed: gone.length, found: events.length };
}
