// Calendar files for This week, read signed out (bar_week and week_event, so
// only public events at bars with a public page):
//   /api/week-ics?event=<event id>   one event, to add to a calendar
//   /api/week-ics?bar=<bar page id>  a bar's next month of public events, to
//                                    subscribe to (webcal://) or put on its website

import { calendarIcs, type IcsEvent } from '../lib/ics';
import { isUuid, supabaseFromEnv } from '../lib/menuPreview';

export const config = { runtime: 'edge' };

interface Row {
  kind: string;
  id: string;
  bar_name: string | null;
  starts_at: string;
  ends_at: string | null;
  name: string;
  description: string | null;
  guest_name: string | null;
  house_menu_on: boolean | null;
  ticket_url: string | null;
}

/** A bar's feed covers this many days ahead. */
const FEED_DAYS = 31;

function toEvent(r: Row, origin: string): IcsEvent {
  const notes = [r.description, r.guest_name ? `With ${r.guest_name}.` : null, r.house_menu_on === false ? 'The house menu is off.' : null, r.ticket_url ? `Book: ${r.ticket_url}` : null];
  return {
    id: r.id,
    name: r.name,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    description: notes.filter(Boolean).join('\n') || null,
    location: r.bar_name,
    url: `${origin}/e/${r.id}`,
  };
}

const text = (body: string, status: number) => new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const db = supabaseFromEnv(process.env);
  if (!db) return text('Not set up', 500);
  const call = async (fn: string, args: object): Promise<Row[]> => {
    const res = await fetch(`${db.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: db.anonKey, Authorization: `Bearer ${db.anonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`${fn} ${res.status}`);
    return (await res.json()) as Row[];
  };

  const eventId = url.searchParams.get('event');
  const pageId = url.searchParams.get('bar');
  try {
    if (isUuid(eventId)) {
      const [row] = await call('week_event', { p_event_id: eventId });
      if (!row) return text('No such event', 404);
      return new Response(calendarIcs([toEvent(row, url.origin)], null), {
        headers: {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="event.ics"',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }
    if (isUuid(pageId)) {
      const res = await fetch(`${db.url}/rest/v1/profiles?select=bar_id,display_name&kind=eq.bar&id=eq.${pageId}`, {
        headers: { apikey: db.anonKey, Authorization: `Bearer ${db.anonKey}` },
      });
      const [page] = res.ok ? ((await res.json()) as { bar_id: string | null; display_name: string }[]) : [];
      if (!page?.bar_id) return text('No such bar', 404);
      // From six hours ago, so tonight's takeover stays in the feed while it's on.
      const from = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
      const rows = (await call('bar_week', { p_bar_id: page.bar_id, p_from: from, p_days: FEED_DAYS })).filter((r) => r.kind === 'event');
      return new Response(calendarIcs(rows.map((r) => toEvent(r, url.origin)), `${page.display_name} this week`), {
        headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, max-age=900' },
      });
    }
  } catch {
    return text('Try again shortly', 502);
  }
  return text('Ask for ?event=<id> or ?bar=<bar page id>', 400);
}
