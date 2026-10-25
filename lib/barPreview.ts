// The link preview for a public bar page (/p/<id or handle>, ppl-og-images'
// bar card): what a chat app shows when someone pastes the link. middleware.ts
// answers link-preview bots with these tags; api/bar-og.ts draws the image.
// Plain fetches and relative imports only: these run on Vercel, outside the
// app's bundle.

import { isUuid, type PreviewMeta } from './menuPreview';

interface Supabase {
  url: string;
  anonKey: string;
}

/** A public bar as anyone reads it, with what the preview names. */
export interface PreviewBar {
  id: string;
  handle: string | null;
  name: string;
  /** "Cocktail bar"; null when the page doesn't say. */
  type: string | null;
  locality: string | null;
  city: string | null;
  logoUrl: string | null;
  /** locked shows no photos or drinks' pictures, as on the page. */
  visibility: string | null;
  /** The menu on now and its drinks, in menu order. */
  menu: { name: string; drinks: { id: string; name: string }[] } | null;
  /** One decimal; null until enough people rank drinks there. */
  score: number | null;
  rankers: number;
}

// A handle as profiles keep it (juniper.jo, dante.westvillage).
const HANDLE = /^[a-z0-9._-]{2,40}$/i;

const headers = (db: Supabase) => ({ apikey: db.anonKey, Authorization: `Bearer ${db.anonKey}`, 'Content-Type': 'application/json' });

async function get<T>(db: Supabase, path: string): Promise<T[]> {
  const res = await fetch(`${db.url}/rest/v1/${path}`, { headers: headers(db) });
  if (!res.ok) throw new Error(`${path.split('?')[0]} ${res.status}`);
  return (await res.json()) as T[];
}

async function rpc<T>(db: Supabase, name: string, body: object): Promise<T> {
  const res = await fetch(`${db.url}/rest/v1/rpc/${name}`, { method: 'POST', headers: headers(db), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${name} ${res.status}`);
  return (await res.json()) as T;
}

interface ProfileRow {
  id: string;
  handle: string | null;
  display_name: string;
  bar_type: string | null;
  locality: string | null;
  city: string | null;
  avatar_url: string | null;
  page_visibility: string | null;
}
interface EditionRow {
  name: string;
  is_current: boolean;
  drinks: { id: string; name: string }[] | null;
}
interface ScoreRow {
  score: number | null;
  rankers: number | null;
}

/** The bar behind /p/<key>, signed out; null for a person's page, a private one, or nothing. */
export async function fetchPreviewBar(db: Supabase, key: string | null | undefined): Promise<PreviewBar | null> {
  const by = isUuid(key) ? `id=eq.${key}` : key && HANDLE.test(key) ? `handle=eq.${encodeURIComponent(key)}` : null;
  if (!by) return null;
  const [p] = await get<ProfileRow>(db, `profiles?select=id,handle,display_name,bar_type,locality,city,avatar_url,page_visibility&kind=eq.bar&is_public=eq.true&${by}&limit=1`);
  if (!p) return null;
  // The same calls the bar page makes: its menus (moderation and private pages applied) and its score.
  const [editions, scores] = await Promise.all([
    rpc<EditionRow[] | null>(db, 'get_menu_editions', { p_profile_id: p.id }),
    rpc<ScoreRow[] | ScoreRow | null>(db, 'get_venue_score', { p_venue_profile_id: p.id }),
  ]);
  const now = (editions ?? []).find((e) => e.is_current) ?? null;
  const score = (Array.isArray(scores) ? scores[0] : scores) ?? null;
  return {
    id: p.id,
    handle: p.handle,
    name: p.display_name,
    type: p.bar_type?.trim() || null,
    locality: p.locality,
    city: p.city,
    logoUrl: p.avatar_url,
    visibility: p.page_visibility,
    menu: now ? { name: now.name, drinks: (now.drinks ?? []).map((d) => ({ id: d.id, name: d.name })) } : null,
    score: score?.score ?? null,
    rankers: score?.rankers ?? 0,
  };
}

/** "Fitzroy, Melbourne". */
export const barPlace = (b: Pick<PreviewBar, 'locality' | 'city'>) => [b.locality, b.city].filter(Boolean).join(', ') || null;

/** "COCKTAIL BAR · FITZROY, MELBOURNE" over the name on the image. */
export const barKicker = (b: Pick<PreviewBar, 'type' | 'locality' | 'city'>) => [b.type ?? 'Bar', barPlace(b)].filter(Boolean).join(' · ');

/** "On now: Field Notes. Smoke & Fig Old Fashioned, Rye Garden Highball and 10 more". */
export function onNowLine(b: Pick<PreviewBar, 'menu'>): string | null {
  if (!b.menu) return null;
  const names = b.menu.drinks.map((d) => d.name);
  const shown = names.slice(0, 2);
  const more = names.length - shown.length;
  const list = more > 0 ? `${shown.join(', ')} and ${more} more` : shown.length === 2 ? shown.join(' and ') : (shown[0] ?? '');
  return list ? `On now: ${b.menu.name}. ${list}` : `On now: ${b.menu.name}`;
}

/** "9.1 bar score · 212 people ranked"; null until it has a score. */
export function scoreLine(b: Pick<PreviewBar, 'score' | 'rankers'>): string | null {
  if (b.score == null) return null;
  return `${b.score.toFixed(1)} bar score · ${b.rankers === 1 ? '1 person' : `${b.rankers} people`} ranked`;
}

/** The drinks the image draws: the first two on the menu, never on a locked page. */
export const pictureDrinks = (b: Pick<PreviewBar, 'menu' | 'visibility'>) => (b.visibility === 'locked' ? [] : (b.menu?.drinks ?? []).slice(0, 2));

/** Changes whenever what the image shows changes. */
export function barVersion(b: PreviewBar, drawn = ''): string {
  const text = [b.name, barKicker(b), b.logoUrl, onNowLine(b), scoreLine(b), pictureDrinks(b).map((d) => d.id).join(','), drawn].join('|');
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * Title "Little Rye"; description "Cocktail bar in Fitzroy, Melbourne. On now: Field Notes. 9.1 bar score. On Cocktail."
 * `link` is what the shared link named the bar by: its handle, or its id. `drawn` is drawingsKey's.
 */
export function barPreviewMeta(b: PreviewBar, origin: string, link: string = b.handle ?? b.id, drawn = ''): PreviewMeta {
  const place = barPlace(b);
  const what = `${b.type ?? 'Bar'}${place ? ` in ${place}` : ''}.`;
  return {
    title: b.name,
    description: [what, b.menu ? `On now: ${b.menu.name}.` : null, b.score != null ? `${b.score.toFixed(1)} bar score.` : null, 'On Cocktail.'].filter(Boolean).join(' '),
    image: `${origin}/api/bar-og?id=${b.id}&v=${barVersion(b, drawn)}`,
    url: `${origin}/p/${link}`,
  };
}
