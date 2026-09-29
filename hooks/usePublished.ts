import { useQuery } from '@tanstack/react-query';

import type { PresentationRecipe } from '@/lib/spec';
import { supabase } from '@/lib/supabase';

/**
 * What bars publish, read the way the public reads it: published_items (the
 * menu card of each published drink), app_recipe_presentation (a spec drink's
 * rows, generic ingredients only) and live releases. Everything here works
 * signed out; see docs/publishing_moderation_proposal.md sections 1 and 2.
 * The queries are marked public: a signed-out load clears every other query,
 * mid-fetch too, which would leave the page loading (lib/clearUserData.ts).
 */

export type PublishMode = 'description' | 'spec';

/** A published drink's menu card (a published_items row that isn't a reference). */
export interface PublishedDrink {
  id: string;
  name: string;
  itemType: string;
  description: string | null;
  barId: string | null;
  glasswareId: string | null;
  iceId: string | null;
  familyId: string | null;
  origin: string | null;
  abv: number | null;
  publishMode: PublishMode;
  publishedAt: string | null;
  imageUrl: string | null;
  imageIsGenerated: boolean;
  creatorProfileId: string | null;
  originBarProfileId: string | null;
  originYear: number | null;
}

/** The bar a drink or release is credited to, from its public profile. */
export interface PublicBar {
  barId: string;
  name: string;
  handle: string;
}

export interface LiveRelease {
  id: string;
  barId: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  releaseDate: string;
  publishedAt: string;
  itemIds: string[];
}

export const PUBLISHED_COLUMNS =
  'id, name, item_type, description, bar_id, glassware_id, ice_id, family_id, origin, abv, publish_mode, published_at, image_url, image_is_generated, creator_profile_id, origin_bar_profile_id, origin_year';

interface PublishedRow {
  id: string;
  name: string;
  item_type: string;
  description: string | null;
  bar_id: string | null;
  glassware_id: string | null;
  ice_id: string | null;
  family_id: string | null;
  origin: string | null;
  abv: number | null;
  publish_mode: PublishMode;
  published_at: string | null;
  image_url: string | null;
  image_is_generated: boolean | null;
  creator_profile_id: string | null;
  origin_bar_profile_id: string | null;
  origin_year: number | null;
}

export function toPublishedDrink(r: PublishedRow): PublishedDrink {
  return {
    id: r.id,
    name: r.name,
    itemType: r.item_type,
    description: r.description,
    barId: r.bar_id,
    glasswareId: r.glassware_id,
    iceId: r.ice_id,
    familyId: r.family_id,
    origin: r.origin,
    abv: r.abv,
    publishMode: r.publish_mode,
    publishedAt: r.published_at,
    imageUrl: r.image_url,
    imageIsGenerated: !!r.image_is_generated,
    creatorProfileId: r.creator_profile_id,
    originBarProfileId: r.origin_bar_profile_id,
    originYear: r.origin_year,
  };
}

const RELEASE_COLUMNS = 'id, bar_id, name, description, cover_url, release_date, published_at, release_items(item_id, sort_order)';

interface ReleaseRow {
  id: string;
  bar_id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  release_date: string;
  published_at: string;
  release_items: { item_id: string; sort_order: number | null }[] | null;
}

function toRelease(r: ReleaseRow): LiveRelease {
  return {
    id: r.id,
    barId: r.bar_id,
    name: r.name,
    description: r.description,
    coverUrl: r.cover_url,
    releaseDate: r.release_date,
    publishedAt: r.published_at,
    itemIds: [...(r.release_items ?? [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((i) => i.item_id),
  };
}

/** Published drinks by id. Ids that aren't (or are no longer) published are left out. */
export async function fetchPublished(ids: string[]): Promise<PublishedDrink[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('published_items').select(PUBLISHED_COLUMNS).in('id', ids).eq('is_reference', false);
  if (error) throw error;
  return ((data ?? []) as PublishedRow[]).map(toPublishedDrink);
}

/** Bars' public names and handles, by bar id. */
export async function fetchPublicBars(barIds: (string | null)[]): Promise<PublicBar[]> {
  const ids = [...new Set(barIds.filter((id): id is string => !!id))];
  if (!ids.length) return [];
  const { data, error } = await supabase.from('profiles').select('bar_id, display_name, handle').in('bar_id', ids).eq('is_public', true);
  if (error) throw error;
  return (data ?? []).map((p) => ({ barId: p.bar_id as string, name: p.display_name as string, handle: p.handle as string }));
}

export const barName = (bars: PublicBar[] | undefined, barId: string | null) => bars?.find((b) => b.barId === barId)?.name ?? null;

const NEW_DRINKS = 20;
const NEW_RELEASES = 10;

/**
 * "New from bars" on Discover: live releases, newest first, and recently
 * published drinks. ponytail: one page of each, everywhere; narrow it to the
 * Discover area (like TopBars) once enough bars publish to need it.
 */
export function useNewFromBars() {
  return useQuery({
    queryKey: ['published', 'new'],
    meta: { public: true },
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const now = new Date().toISOString();
      const [releases, drinks] = await Promise.all([
        // Publishers can also read their own drafts and scheduled releases: only live ones here.
        supabase.from('releases').select(RELEASE_COLUMNS).lte('published_at', now).order('published_at', { ascending: false }).limit(NEW_RELEASES),
        supabase
          .from('published_items')
          .select(PUBLISHED_COLUMNS)
          .eq('is_reference', false)
          .in('item_type', ['cocktail', 'beer', 'wine'])
          .order('published_at', { ascending: false, nullsFirst: false })
          .limit(NEW_DRINKS),
      ]);
      if (releases.error) throw releases.error;
      if (drinks.error) throw drinks.error;
      const list = ((releases.data ?? []) as ReleaseRow[]).map(toRelease);
      const published = ((drinks.data ?? []) as PublishedRow[]).map(toPublishedDrink);
      const bars = await fetchPublicBars([...list.map((r) => r.barId), ...published.map((d) => d.barId)]);
      return { releases: list, drinks: published, bars };
    },
  });
}

export interface PublishedDrinkPage {
  drink: PublishedDrink;
  bar: PublicBar | null;
  /** Glass, ice and family names, from the drink's reference rows. */
  glass: { name: string; iconKey: string | null } | null;
  ice: string | null;
  family: string | null;
  /** Only for a drink published with its spec: generic ingredients, amounts, units. */
  recipes: PresentationRecipe[];
}

/** One published drink's public page, or null when it isn't (or is no longer) published. */
export function usePublishedDrink(id: string | null | undefined) {
  return useQuery({
    queryKey: ['published', 'drink', id],
    meta: { public: true },
    enabled: !!id,
    queryFn: async (): Promise<PublishedDrinkPage | null> => {
      const [drink] = await fetchPublished([id!]);
      if (!drink) return null;
      const refIds = [drink.glasswareId, drink.iceId, drink.familyId].filter((x): x is string => !!x);
      const [refs, bars, recipes] = await Promise.all([
        refIds.length ? supabase.from('published_items').select('id, name, icon_key').in('id', refIds) : Promise.resolve({ data: [], error: null }),
        fetchPublicBars([drink.barId]),
        drink.publishMode === 'spec'
          ? supabase
              .from('app_recipe_presentation')
              .select('id, sort_order, created_at, amount, unit, is_optional, display_ingredient_id, display_ingredient:published_ingredient(id, name)')
              .eq('recipe_item_id', drink.id)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (refs.error) throw refs.error;
      if (recipes.error) throw recipes.error;
      const ref = (refId: string | null) => (refs.data ?? []).find((r) => r.id === refId) as { name: string; icon_key: string | null } | undefined;
      const glass = ref(drink.glasswareId);
      return {
        drink,
        bar: bars[0] ?? null,
        glass: glass ? { name: glass.name, iconKey: glass.icon_key } : null,
        ice: ref(drink.iceId)?.name ?? null,
        family: ref(drink.familyId)?.name ?? null,
        // published_ingredient returns a set, so PostgREST embeds an array.
        recipes: (recipes.data ?? []).map((r) => {
          const ing = r.display_ingredient as { id: string; name: string }[] | { id: string; name: string } | null;
          return { ...r, display_ingredient: Array.isArray(ing) ? (ing[0] ?? null) : ing } as PresentationRecipe;
        }),
      };
    },
  });
}

export interface ReleasePage {
  release: LiveRelease;
  bar: PublicBar | null;
  /** The release's drinks the public can still see, in order. */
  drinks: PublishedDrink[];
}

/** A live release with its published drinks, or null when it isn't live. */
export function useRelease(id: string | null | undefined) {
  return useQuery({
    queryKey: ['published', 'release', id],
    meta: { public: true },
    enabled: !!id,
    queryFn: async (): Promise<ReleasePage | null> => {
      const { data, error } = await supabase.from('releases').select(RELEASE_COLUMNS).eq('id', id!).lte('published_at', new Date().toISOString()).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const release = toRelease(data as ReleaseRow);
      const [drinks, bars] = await Promise.all([fetchPublished(release.itemIds), fetchPublicBars([release.barId])]);
      const order = new Map(release.itemIds.map((itemId, i) => [itemId, i]));
      return { release, bar: bars[0] ?? null, drinks: drinks.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)) };
    },
  });
}
