// The link preview for a public bar page (/p/<id or handle>, ppl-og-images'
// bar card): what a chat app shows when someone pastes the link. middleware.ts
// answers link-preview bots with these tags; api/bar-og.ts draws the image.
// Plain fetches and relative imports only: these run on Vercel, outside the
// app's bundle.

import { fetchPreviewDrinks, fetchSketchInputs, select, versionHash, type PreviewDrink, type PreviewMeta } from './menuPreview';
import { parseProfileRef } from './profiles';

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

const headers = (db: Supabase) => ({ apikey: db.anonKey, Authorization: `Bearer ${db.anonKey}`, 'Content-Type': 'application/json' });

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
  // As the page reads /p/<ref>: an id, or a handle in any case, with or without "@".
  const ref = parseProfileRef(key);
  if (!ref) return null;
  const by = 'id' in ref ? `id=eq.${ref.id}` : `handle=eq.${ref.handle}`;
  const [p] = await select<ProfileRow>(db, `profiles?select=id,handle,display_name,bar_type,locality,city,avatar_url,page_visibility&kind=eq.bar&is_public=eq.true&${by}&limit=1`);
  if (!p) return null;
  // The same calls the bar page makes: its menus (moderation and private pages applied) and its score.
  const [editions, scores] = await Promise.all([
    rpc<EditionRow[] | null>(db, 'get_menu_editions', { p_profile_id: p.id }),
    // A score that won't load leaves the line out, not the whole preview.
    rpc<ScoreRow[] | ScoreRow | null>(db, 'get_venue_score', { p_venue_profile_id: p.id }).catch(() => null),
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

/** How far down the menu the image looks for drinks it can draw. */
const LOOK = 8;

/**
 * The drinks the image draws: the first two on the menu that anyone can see
 * and that have a photo or a drawing, never on a locked page. `key` changes
 * when what they show does (a photo added, a drawing recoloured), for the
 * image's version.
 */
export async function pictureDrinks(db: Supabase, b: Pick<PreviewBar, 'menu' | 'visibility'>): Promise<{ drinks: PreviewDrink[]; sketches: { item_id: string; inputs: unknown }[]; key: string }> {
  const ids = b.visibility === 'locked' ? [] : (b.menu?.drinks ?? []).slice(0, LOOK).map((d) => d.id);
  if (!ids.length) return { drinks: [], sketches: [], key: '' };
  const [rows, sketches] = await Promise.all([fetchPreviewDrinks(db, ids), fetchSketchInputs<{ variant?: string | null; tint?: string | null; ice?: string }>(db, ids)]);
  const photo = (d: PreviewDrink) => !!d.image_url && !d.image_is_generated;
  const drinks = ids
    .map((id) => rows.find((d) => d.id === id))
    .filter((d): d is PreviewDrink => !!d && (photo(d) || sketches.some((s) => s.item_id === d.id)))
    .slice(0, 2);
  const key = drinks
    .map((d) => {
      const x = sketches.find((s) => s.item_id === d.id)?.inputs;
      return `${d.id}:${photo(d) ? d.image_url : ''}:${x?.variant ?? ''}:${x?.tint ?? ''}:${x?.ice ?? ''}`;
    })
    .join(',');
  return { drinks, sketches: sketches.filter((s) => drinks.some((d) => d.id === s.item_id)), key };
}

/** Changes whenever what the image shows changes. `drawn` is pictureDrinks' key. */
export function barVersion(b: PreviewBar, drawn = ''): string {
  return versionHash([b.name, barKicker(b), b.logoUrl, onNowLine(b), scoreLine(b), drawn].join('|'));
}

/**
 * Title "Little Rye"; description "Cocktail bar in Fitzroy, Melbourne. On now: Field Notes. 9.1 bar score. On Cocktail."
 * `link` is what the shared link named the bar by: its handle, or its id. `drawn` is pictureDrinks' key.
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
