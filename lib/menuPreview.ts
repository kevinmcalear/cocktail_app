// The link preview for a shared home menu (/m/<id>): what a chat app shows
// when someone pastes the link. middleware.ts answers link-preview bots with
// these tags; api/menu-og.ts draws the image. Plain fetches and relative
// imports only: these run on Vercel, outside the app's bundle.

/** The parts of shared_menu() (supabase/migrations/20260930930000_share_home_menus.sql) a preview needs. */
export interface SharedMenuRow {
  id: string;
  name: string;
  menu_date: string | null;
  cover_url: string | null;
  owner: { name: string; handle: string };
  /** Each entry is a public drink's id, or null for one that isn't public (its name stays private). */
  sections: { name: string; item_ids: (string | null)[] }[];
}

export interface PreviewDrink {
  id: string;
  name: string;
  image_url: string | null;
  image_is_generated: boolean;
}

export interface PreviewMeta {
  title: string;
  description: string;
  image: string;
  url: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string | null | undefined): s is string => !!s && UUID.test(s);

// Chat apps and social sites fetch a link to build its preview; none of them run the app.
// iMessage sends "facebookexternalhit … Twitterbot", Signal sends "WhatsApp".
const PREVIEW_BOTS = /facebookexternalhit|facebot|twitterbot|whatsapp|slackbot|discordbot|telegrambot|linkedinbot|skypeuripreview|applebot|googlebot|bingbot|pinterest|redditbot|embedly|iframely|mastodon|vkshare|viber|line-poker|snapchat|bluesky|cardyb/i;
export const isPreviewBot = (ua: string | null | undefined) => !!ua && PREVIEW_BOTS.test(ua);

/** "Saturday 31 October" for a menu's night (a plain date, no time zone). */
export function nightLabel(day: string | null): string | null {
  const m = day?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/** "Americano, Last Word and 2 house drinks": public drinks by name, the rest only counted. */
export function drinksLine(menu: SharedMenuRow, drinks: PreviewDrink[]): string {
  const ids = menu.sections.flatMap((s) => s.item_ids);
  const names = ids.map((id) => (id ? drinks.find((d) => d.id === id)?.name : null)).filter((n): n is string => !!n);
  const hidden = ids.length - names.length;
  const parts = [...names, ...(hidden ? [hidden === 1 ? 'a house drink' : `${hidden} house drinks`] : [])];
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** Changes whenever what the image shows changes, so a chat app's cached image doesn't outlive an edit. */
export function menuVersion(menu: SharedMenuRow): string {
  const text = [menu.name, menu.menu_date, menu.cover_url, menu.owner.name, ...menu.sections.flatMap((s) => s.item_ids)].join('|');
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function previewMeta(menu: SharedMenuRow, drinks: PreviewDrink[], origin: string): PreviewMeta {
  const night = nightLabel(menu.menu_date);
  const line = drinksLine(menu, drinks);
  const count = menu.sections.reduce((n, s) => n + s.item_ids.length, 0);
  return {
    title: night ? `${menu.name} · ${night}` : menu.name,
    description: [line ? `${line}.` : `${count} drinks.`, `A menu by ${menu.owner.name} on Cocktail.`].join(' '),
    image: `${origin}/api/menu-og?id=${menu.id}&v=${menuVersion(menu)}`,
    url: `${origin}/m/${menu.id}`,
  };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The page a link-preview bot gets: the tags, and a plain link for anything that reads the body. */
export function previewHtml(meta: PreviewMeta): string {
  const t = esc(meta.title);
  const d = esc(meta.description);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${esc(meta.url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Cocktail">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${esc(meta.url)}">
<meta property="og:image" content="${esc(meta.image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${t}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${esc(meta.image)}">
</head><body><a href="${esc(meta.url)}">${t}</a></body></html>`;
}

interface Supabase {
  url: string;
  anonKey: string;
}

/** Signed out, as anyone reads it: the shared menu, or null if it isn't shared (or its owner isn't public). */
export async function fetchSharedMenu(db: Supabase, id: string): Promise<SharedMenuRow | null> {
  const res = await fetch(`${db.url}/rest/v1/rpc/shared_menu`, {
    method: 'POST',
    headers: { apikey: db.anonKey, Authorization: `Bearer ${db.anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_menu_id: id }),
  });
  if (!res.ok) throw new Error(`shared_menu ${res.status}`);
  return ((await res.json()) as SharedMenuRow | null) ?? null;
}

async function select<T>(db: Supabase, path: string): Promise<T[]> {
  const res = await fetch(`${db.url}/rest/v1/${path}`, { headers: { apikey: db.anonKey, Authorization: `Bearer ${db.anonKey}` } });
  if (!res.ok) throw new Error(`${path.split('?')[0]} ${res.status}`);
  return (await res.json()) as T[];
}

const inList = (ids: string[]) => `in.(${ids.join(',')})`;

/** The public drinks' names and pictures (published_items, as the shared page reads them). */
export function fetchPreviewDrinks(db: Supabase, ids: string[]): Promise<PreviewDrink[]> {
  if (!ids.length) return Promise.resolve([]);
  return select<PreviewDrink>(db, `published_items?select=id,name,image_url,image_is_generated&is_reference=eq.false&id=${inList(ids)}`);
}

/** The drawing inputs of drinks without a photo (item_sketches; readable wherever the drink is). */
export function fetchSketchInputs<T>(db: Supabase, ids: string[]): Promise<{ item_id: string; inputs: T }[]> {
  if (!ids.length) return Promise.resolve([]);
  return select<{ item_id: string; inputs: T }>(db, `item_sketches?select=item_id,inputs&item_id=${inList(ids)}`);
}

/** The project's public Supabase settings, as the web build has them. */
export function supabaseFromEnv(env: Record<string, string | undefined>): Supabase | null {
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url: url.replace(/\/$/, ''), anonKey } : null;
}
