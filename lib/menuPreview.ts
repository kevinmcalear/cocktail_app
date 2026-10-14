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

// A readable link's name (/d/penicillin, /m/halloween-party): words joined by
// hyphens, as share_slug_base() makes them (20261016300000_share_slugs.sql).
// A uuid is always read as the id.
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/i;
export const isShareSlug = (s: string | null | undefined): s is string => !!s && s.length <= 100 && SLUG.test(s) && !UUID.test(s);

/** /d/<id> is a drink's link, /m/<id> a shared menu's. */
export type ShareKind = 'd' | 'm';

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
export function menuVersion(menu: SharedMenuRow, drawn = ''): string {
  const text = [menu.name, menu.menu_date, menu.cover_url, menu.owner.name, ...menu.sections.flatMap((s) => s.item_ids), drawn].join('|');
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** `link` is what the shared link named the menu by: its slug, or its id. `drawn` is drawingsKey's. */
export function previewMeta(menu: SharedMenuRow, drinks: PreviewDrink[], origin: string, link: string = menu.id, drawn = ''): PreviewMeta {
  const night = nightLabel(menu.menu_date);
  const count = menu.sections.reduce((n, s) => n + s.item_ids.length, 0);
  const howMany = `${count} ${count === 1 ? 'drink' : 'drinks'}`;
  return {
    // As the boards draw it (ppl-preview-imessage): the name, then "4 drinks for Saturday 31 October."
    title: menu.name,
    description: `${night ? `${howMany} for ${night}` : howMany}. A menu on Cocktail.`,
    image: `${origin}/api/menu-og?id=${menu.id}&v=${menuVersion(menu, drawn)}`,
    url: `${origin}/m/${link}`,
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

/**
 * The id behind a link's last part, signed out: a uuid is itself, a slug is
 * asked of share_target(), which answers only while the drink is published or
 * the menu is shared. Null for anything else.
 */
export async function resolveShareId(db: Supabase, kind: ShareKind, key: string | null | undefined): Promise<string | null> {
  if (isUuid(key)) return key;
  if (!isShareSlug(key)) return null;
  const res = await fetch(`${db.url}/rest/v1/rpc/share_target`, {
    method: 'POST',
    headers: { apikey: db.anonKey, Authorization: `Bearer ${db.anonKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_kind: kind, p_slug: key }),
  });
  if (!res.ok) throw new Error(`share_target ${res.status}`);
  const id = (await res.json()) as string | null;
  return isUuid(id) ? id : null;
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

const HOUSE_ICE = ['cubes', 'large', 'spear', 'crushed', 'pebble', 'shaved', 'sphere'];

/**
 * The drawing inputs of drinks without a photo (item_sketches; readable
 * wherever the drink is), with the venue's ice over a guessed one, as
 * readSketchInputs (lib/sketch/types.ts) draws it in the app.
 */
export async function fetchSketchInputs<T>(db: Supabase, ids: string[]): Promise<{ item_id: string; inputs: T }[]> {
  if (!ids.length) return [];
  const rows = await select<{ item_id: string; inputs: T }>(db, `item_sketches?select=item_id,inputs&item_id=${inList(ids)}`);
  return rows.map((r) => {
    const x = r.inputs as { houseIce?: unknown } | null;
    return typeof x?.houseIce === 'string' && HOUSE_ICE.includes(x.houseIce) ? { ...r, inputs: { ...r.inputs, ice: x.houseIce } } : r;
  });
}

/**
 * What the drinks' drawings were picked to look like (their glass drawing,
 * sketch colour and ice), for an image's version: a recolour is a new image, not a
 * week of the cached one.
 */
export async function drawingsKey(db: Supabase, ids: string[]): Promise<string> {
  const rows = await fetchSketchInputs<{ variant?: string | null; tint?: string | null; ice?: string }>(db, ids);
  return rows.map((r) => `${r.item_id}:${r.inputs?.variant ?? ''}:${r.inputs?.tint ?? ''}:${r.inputs?.ice ?? ''}`).sort().join(',');
}

/** The project's public Supabase settings, as the web build has them. */
export function supabaseFromEnv(env: Record<string, string | undefined>): Supabase | null {
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return url && anonKey ? { url: url.replace(/\/$/, ''), anonKey } : null;
}
