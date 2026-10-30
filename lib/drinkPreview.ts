// The link preview for a public drink (/d/<id>, ppl-og-drink and
// ppl-preview-imessage/slack): what a chat app shows when someone pastes the
// link. middleware.ts answers link-preview bots with these tags;
// api/drink-og.ts draws the image. Plain fetches and relative imports only:
// these run on Vercel, outside the app's bundle.

import type { PreviewMeta } from './menuPreview';
import { drinkKicker, ingredientsLine, type IngredientName } from './publicDrink';

interface Supabase {
  url: string;
  anonKey: string;
}

/** A published drink as anyone reads it, with what the preview names. */
export interface PreviewDrinkCard {
  id: string;
  name: string;
  description: string | null;
  origin: string | null;
  origin_year: number | null;
  riff_of_id: string | null;
  bar_id: string | null;
  publish_mode: string;
  image_url: string | null;
  image_is_generated: boolean | null;
  /** Who made it, and the bar it's from (a venue's own, or the one it's credited to). */
  creator: string | null;
  bar: string | null;
  /** The drink it's a riff or version of, with its other names; null when there's none or it can't be read. */
  riff_of: { name: string; aliases: string[] } | null;
  /** Its ingredient names, never amounts (public_drink_ingredients); empty on a locked bar page. */
  ingredients: IngredientName[];
}

async function get<T>(db: Supabase, path: string): Promise<T[]> {
  const res = await fetch(`${db.url}/rest/v1/${path}`, { headers: { apikey: db.anonKey, Authorization: `Bearer ${db.anonKey}` } });
  if (!res.ok) throw new Error(`${path.split('?')[0]} ${res.status}`);
  return (await res.json()) as T[];
}

type Row = Omit<PreviewDrinkCard, 'creator' | 'bar' | 'ingredients' | 'riff_of'> & { creator_profile_id: string | null; origin_bar_profile_id: string | null };

/** The drink, signed out; null when it isn't (or is no longer) public. */
export async function fetchPreviewDrinkCard(db: Supabase, id: string): Promise<PreviewDrinkCard | null> {
  const [d] = await get<Row>(
    db,
    `published_items?select=id,name,description,origin,origin_year,riff_of_id,bar_id,publish_mode,image_url,image_is_generated,creator_profile_id,origin_bar_profile_id&is_reference=eq.false&id=eq.${id}`
  );
  if (!d) return null;
  const ids = [d.creator_profile_id, d.origin_bar_profile_id].filter(Boolean);
  const riff = d.riff_of_id;
  const [people, venue, lines, parent, aliases] = await Promise.all([
    ids.length ? get<{ id: string; display_name: string }>(db, `profiles?select=id,display_name&is_public=eq.true&id=in.(${ids.join(',')})`) : Promise.resolve([]),
    d.bar_id ? get<{ display_name: string }>(db, `profiles?select=display_name&kind=eq.bar&is_public=eq.true&bar_id=eq.${d.bar_id}`) : Promise.resolve([]),
    get<IngredientName>(db, `rpc/public_drink_ingredients?p_item_ids=%7B${id}%7D`),
    riff ? get<{ name: string }>(db, `published_items?select=name&is_reference=eq.false&id=eq.${riff}`) : Promise.resolve([]),
    riff ? get<{ alias: string }>(db, `classic_aliases?select=alias&classic_id=eq.${riff}`) : Promise.resolve([]),
  ]);
  const name = (pid: string | null) => people.find((p) => p.id === pid)?.display_name ?? null;
  const ingredients = lines.map(({ name, brand }) => ({ name, brand }));
  const { creator_profile_id, origin_bar_profile_id, ...rest } = d;
  const riffOf = parent[0] ? { name: parent[0].name, aliases: aliases.map((a) => a.alias) } : null;
  return { ...rest, creator: name(creator_profile_id), bar: venue[0]?.display_name ?? name(origin_bar_profile_id), ingredients, riff_of: riffOf };
}

/** "Scotch, lemon, honey syrup, ginger": its ingredient names, else the description. */
export function drinkLine(d: Pick<PreviewDrinkCard, 'ingredients' | 'description'>): string | null {
  return ingredientsLine(d.ingredients) ?? (d.description?.trim().replace(/\.$/, '') || null);
}

/** "Sam Ross, 2005", or the bar when nobody's named. */
export function madeBy(d: Pick<PreviewDrinkCard, 'creator' | 'bar' | 'origin_year'>): string | null {
  const who = d.creator ?? d.bar;
  return [who, d.origin_year ? String(d.origin_year) : null].filter(Boolean).join(', ') || null;
}

/** "Created by Sam Ross · Milk & Honey" for the image. */
export function createdBy(d: Pick<PreviewDrinkCard, 'creator' | 'bar'>): string | null {
  if (d.creator) return d.bar ? `Created by ${d.creator} · ${d.bar}` : `Created by ${d.creator}`;
  return d.bar ? `From ${d.bar}` : null;
}

/** "MODERN CLASSIC · 2005" over the name on the image. */
export const drinkKickerFor = (d: PreviewDrinkCard) => drinkKicker({ name: d.name, origin: d.origin, originYear: d.origin_year, riffOfId: d.riff_of_id, riffOf: d.riff_of }, d.bar_id ? d.bar : null);

/** Changes whenever what the image shows changes. */
export function drinkVersion(d: PreviewDrinkCard, drawn = ''): string {
  const text = [d.name, d.origin, d.origin_year, d.image_url, d.creator, d.bar, drinkLine(d), drawn].join('|');
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * Title "Penicillin"; description "Scotch, lemon, honey-ginger, an Islay float. Sam Ross, 2005. On Cocktail."
 * `link` is what the shared link named the drink by: its slug, or its id. `drawn` is drawingsKey's.
 */
export function drinkPreviewMeta(d: PreviewDrinkCard, origin: string, link: string = d.id, drawn = ''): PreviewMeta {
  const line = drinkLine(d);
  const by = madeBy(d);
  return {
    title: d.name,
    description: [line ? `${line}.` : null, by ? `${by}.` : null, 'On Cocktail.'].filter(Boolean).join(' '),
    image: `${origin}/api/drink-og?id=${d.id}&v=${drinkVersion(d, drawn)}`,
    url: `${origin}/d/${link}`,
  };
}


