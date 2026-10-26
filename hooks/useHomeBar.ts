import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useDebounced } from '@/hooks/useDiscover';
import { ensureIngredient } from '@/hooks/useCreateIngredient';
import { useDropdowns } from '@/hooks/useDropdowns';
import { withNear, type MaybeNear } from '@/hooks/useSearchNear';
import { chunk } from '@/lib/commandSearchGrid';
import { likeExactly, searchByName } from '@/lib/drinkWizard';
import { barSection, type BarSection } from '@/lib/barSections';
import { kindsCovered } from '@/lib/myBarAdd';
import { heroPicture, type ItemImageLink } from '@/lib/itemImages';
import { sortMatches, type MatchRow } from '@/lib/barMatches';
import { specNoteText, type ServedBar } from '@/lib/servedAt';
import { capitalizeFirst } from '@/lib/stringUtils';
import { PANTRY, PANTRY_WATER } from '@/lib/pantry';
import { TECHNICAL_INGREDIENTS } from '@/lib/techniques/ingredients';
import { supabase } from '@/lib/supabase';

export interface BarItem {
  id: string;
  name: string;
  type: 'cocktail' | 'ingredient';
  imageUrl: string | null;
  /** Glass icon key, for the drawn placeholder when there's no photo. */
  glass: string | null;
  /** For a drink you can make: the shelf rows it uses (my_bar_drinks). */
  shelfUses?: string[];
  /** The bar a drink is from, so a classic's many bar versions tell apart. */
  from?: { name: string; logo: string | null };
  /** A classic: the bars that pour it as it is ("Served at Harry's Bar, The Gold Room +5"). */
  served?: { count: number; bars: ServedBar[] };
  /** A bar's variation of a classic: what it changes ("uses Rye Whiskey, not Bourbon"). */
  variation?: string;
}

/** A house prep the shelf can make but doesn't have, and every drink that leans on it (my_bar_preps). */
export interface MadePrep {
  id: string;
  name: string;
  drinks: string[];
}

/** A house prep one line short of your shelf, what that line wants, and the drinks that use the prep (my_bar_preps_short). */
export interface ShortPrep {
  id: string;
  name: string;
  missing_id: string;
  missing_name: string;
  drinks: string[];
}

/** A bottle you finished: when it went on the shelf and when it came off (home_bar_finished). */
export interface FinishedBottle {
  id: string;
  itemId: string;
  name: string;
  boughtAt: string | null;
  finishedAt: string;
}

interface ItemRow {
  id: string;
  name: string;
  item_type: 'cocktail' | 'ingredient';
  glassware_id?: string | null;
  item_images: ItemImageLink[] | null;
  brand_maker?: string | null;
  abv?: number | null;
  origin?: string | null;
  generic_id?: string | null;
  ingredient_role?: string | null;
  recipes?: { id: string }[] | null;
}

/** A bottle on the shelf, with what the shelf list says about it. */
export interface ShelfItem extends BarItem {
  maker: string | null;
  abv: number | null;
  /** What it's a kind of ("Bourbon"), when the person can see that. */
  kind: string | null;
  /** How many drinks you can make with it. */
  uses: number;
  role?: string | null;
  hasRecipe?: boolean;
  /** When it went on the shelf (for a house prep: when you made it). */
  addedAt?: string | null;
  /** Where My Bar lists it. */
  section: BarSection;
  /** A bottle (`product`): the kinds it's a bottle of, its own and that one's ("London dry gin", "Gin"), as ids. */
  kindIds?: string[];
}

/** A search result for the add sheet, with the section it goes in and what it is ("Liqueur", "Italy"). */
export interface FoundItem extends BarItem {
  section: BarSection;
  kind: string | null;
  origin: string | null;
  /** `product` for a bottle you buy; a style (Gin) is `generic`. */
  role: string | null;
  /** A search for a kind ("gin"): the kind this bottle was found under, though "gin" isn't in its name. */
  of?: string;
}

export const SHELF_KEY = ['home-bar'];
const NONE: string[] = [];
const ITEM_SELECT = 'id, name, item_type, glassware_id, item_images(angle, sort_order, is_generated, images(url))';
const SHELF_SELECT = `${ITEM_SELECT}, brand_maker, abv, generic_id, ingredient_role, recipes:app_recipe_presentation!recipe_item_id(id)`;
const FOUND_SELECT = 'id, name, abv, origin, generic_id, ingredient_role, item_images(angle, sort_order, is_generated, images(url)), recipes:app_recipe_presentation!recipe_item_id(id)';

/** Add-sheet rows from catalog rows, each with its section and the name of what it's a kind of. */
async function foundItems(rows: ItemRow[]): Promise<FoundItem[]> {
  const kindIds = [...new Set(rows.map((r) => r.generic_id).filter((id): id is string => !!id))];
  const kinds = new Map((kindIds.length ? await readItems(kindIds, 'id, name') : []).map((k) => [k.id, k.name]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: 'ingredient' as const,
    imageUrl: heroPicture(r.item_images)?.url ?? null,
    glass: null,
    section: barSection({ name: r.name, role: r.ingredient_role, abv: r.abv, hasRecipe: !!r.recipes?.length }),
    kind: (r.generic_id && kinds.get(r.generic_id)) || null,
    origin: r.origin ?? null,
    role: r.ingredient_role ?? null,
  }));
}

/** The bottles on the signed-in person's shelf (item ids, newest first). */
export function useShelf() {
  return useQuery({
    queryKey: SHELF_KEY,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('home_bar_items')
        .select('item_id')
        .order('added_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: { item_id: string }) => r.item_id);
    },
  });
}

/** The catalog's ingredients for what was typed, as Add to your bar lists them. */
async function searchBar(query: string): Promise<FoundItem[]> {
    // Names that start with it, and any that have it: "Gin" can't sort out of reach behind "Aged gin…".
    const read = (pattern: string, limit: number) =>
      supabase
        .from('app_item_presentation')
        .select(FOUND_SELECT)
        .eq('item_type', 'ingredient')
        .ilike('name', pattern)
        .order('name')
        .order('id')
        .limit(limit);
    const like = likeExactly(query);
    // A lab ingredient goes by several names ("pectinex" is "Pectinase" in the catalog): look for them all.
    const q = query.toLowerCase();
    const aliases = TECHNICAL_INGREDIENTS.find((t) => t.names.some((n) => n.startsWith(q)))?.names.filter((n) => !n.includes(q)) ?? [];
    const [starts, has, also] = await Promise.all([
      read(`${like}%`, 50),
      read(`%${like}%`, 150),
      aliases.length
        ? supabase
            .from('app_item_presentation')
            .select(FOUND_SELECT)
            .eq('item_type', 'ingredient')
            .or(aliases.map((n) => `name.ilike.${likeExactly(n)}`).join(','))
            .limit(10)
        : { data: [], error: null },
    ]);
    if (starts.error) throw starts.error;
    if (has.error) throw has.error;
    if (also.error) throw also.error;
    const byId = new Map([...(starts.data ?? []), ...(has.data ?? [])].map((r) => [r.id, r]));
    const rows = [...byId.values()] as unknown as ItemRow[];
    // Alias matches first: their names don't contain what was typed, so searchByName would drop them.
    const named = (also.data ?? []) as unknown as ItemRow[];
    const best = [...named, ...searchByName(query, rows, 40).filter((r) => !named.some((n) => n.id === r.id))];
    // A kind typed ("gin"): its bottles too, whatever their names (Tanqueray). The one named exactly, else the first that starts with it.
    const key = query.trim().toLowerCase();
    const styles = best.filter((r) => r.ingredient_role !== 'product');
    const kind = styles.find((r) => r.name.toLowerCase() === key) ?? styles.find((r) => r.name.toLowerCase().startsWith(key));
    const bottles = kind ? (await kindBottles(kind.id, '', 3)).filter((b) => !best.some((r) => r.id === b.id)) : [];
    const out = await foundItems([...best, ...bottles]);
    return out.map((r, i) => (i < best.length ? r : { ...r, of: kind!.id }));
}

/**
 * The bottles of a kind, through its styles (Gin's London dry gins): those
 * with a photo first, then by name, `text` narrowing them by name.
 * ponytail: two levels (a kind, its styles), which is as deep as the
 * catalog's spirits go under a kind someone ticks; walk further if it grows.
 */
async function kindBottles(kindId: string, text: string, limit: number): Promise<ItemRow[]> {
  const under = await supabase.from('items').select('id').eq('generic_id', kindId).or('ingredient_role.is.null,ingredient_role.eq.generic').limit(200);
  if (under.error) throw under.error;
  let read = supabase
    .from('app_item_presentation')
    .select(FOUND_SELECT)
    .eq('ingredient_role', 'product')
    .is('bar_id', null)
    .eq('hide_from_search', false)
    .in('generic_id', [kindId, ...(under.data ?? []).map((r) => r.id)]);
  if (text.trim()) read = read.ilike('name', `%${likeExactly(text.trim())}%`);
  const { data, error } = await read.order('picture_url', { nullsFirst: false }).order('name').limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ItemRow[];
}

/** How many bottles Which gin? lists before a search narrows them. */
export const KIND_PAGE = 60;

/** "Which gin?": the kind's bottles in the catalog, searched by name. None means the kind gets no Which link. */
export function useKindBottles(kindId: string | null, text = '') {
  const query = useDebounced(text.trim(), 200);
  return useQuery({
    queryKey: ['kind-bottles', kindId, query],
    enabled: !!kindId,
    placeholderData: keepPreviousData,
    staleTime: 60 * 60 * 1000,
    meta: { persist: false },
    queryFn: async (): Promise<FoundItem[]> => foundItems(await kindBottles(kindId!, query, KIND_PAGE)),
  });
}

/**
 * Add “X” in Add to your bar: an ingredient by name alone (the existing one
 * if any spelling or alias matches, as the ingredient wizard saves a typed
 * line), put on your bar. Gives back its id and name.
 */
export function useAddByName() {
  const client = useQueryClient();
  const { add } = useShelfEdit();
  return useMutation({
    mutationFn: async (name: string): Promise<{ id: string; name: string }> => {
      const id = await ensureIngredient({ id: null, name: name.trim() }, null, new Map());
      await add.mutateAsync(id);
      return { id, name: capitalizeFirst(name.trim()) };
    },
    // A search for it now finds it, ticked.
    onSuccess: () => client.invalidateQueries({ queryKey: ['bar-search'] }),
  });
}

/** Rows by id, as searchBar has them: the close names. */
export async function readFound(ids: string[]): Promise<FoundItem[]> {
  const { data, error } = await supabase.from('app_item_presentation').select(FOUND_SELECT).in('id', ids);
  if (error) throw error;
  return foundItems((data ?? []) as unknown as ItemRow[]);
}

/**
 * Ingredients whose name has the text in it, best first, searched on the
 * server so the add sheet never waits on the whole catalog. Each says which
 * My Bar section it goes in; house preps come too, for "I have some".
 */
export function useBarSearch(text: string) {
  const query = useDebounced(text.trim(), 200);
  return useQuery({
    queryKey: ['bar-search', query],
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
    meta: { persist: false },
    // "chartruse": Green Chartreuse, marked `near` (Did you mean).
    queryFn: ({ signal }): Promise<MaybeNear<FoundItem>[]> => withNear(query, 'ingredient', searchBar(query), readFound, signal),
  });
}

/**
 * The shared catalog's items with these names (any case), in the order given,
 * with the section each goes in: the ideas Add to your bar offers before
 * anything is typed. Names the catalog doesn't have are left out.
 */
export function useBarIdeas(names: readonly string[]) {
  return useQuery({
    queryKey: ['bar-ideas', names],
    enabled: names.length > 0,
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async (): Promise<FoundItem[]> => {
      const { data, error } = await supabase
        .from('app_item_presentation')
        .select(FOUND_SELECT)
        .eq('item_type', 'ingredient')
        .is('bar_id', null)
        .or(names.map((n) => `name.ilike."${likeExactly(n).replace(/"/g, '\\"')}"`).join(','))
        .order('id');
      if (error) throw error;
      // One per name, the first by id, as the pantry staples are picked.
      const byName = new Map<string, ItemRow>();
      for (const r of (data ?? []) as unknown as ItemRow[]) if (!byName.has(r.name.toLowerCase())) byName.set(r.name.toLowerCase(), r);
      return foundItems(names.flatMap((n) => byName.get(n.toLowerCase()) ?? []));
    },
  });
}

/** Add or remove a bottle. The row's owner defaults to the caller. */
export function useShelfEdit() {
  const client = useQueryClient();
  // The shelf, its names and what it makes all sit under SHELF_KEY.
  const onSettled = () => client.invalidateQueries({ queryKey: SHELF_KEY });
  const onMutateWith = (change: (ids: string[]) => string[]) => () => {
    const before = client.getQueryData<string[]>(SHELF_KEY);
    client.setQueryData<string[]>(SHELF_KEY, (ids) => change(ids ?? []));
    return { before };
  };
  // One bottle or several (the pantry's "I have all of these"); ones already on the shelf are left as they are.
  const add = useMutation({
    mutationFn: async (itemIds: string | string[]) => {
      const rows = [itemIds].flat().map((item_id) => ({ item_id }));
      const { error } = await supabase.from('home_bar_items').upsert(rows, { onConflict: 'user_id,item_id', ignoreDuplicates: true });
      if (error) throw error;
    },
    onMutate: (itemIds) => onMutateWith((ids) => [...[itemIds].flat(), ...ids.filter((i) => ![itemIds].flat().includes(i))])(),
    onError: (_e, _id, ctx) => client.setQueryData(SHELF_KEY, ctx?.before),
    onSettled,
  });
  const remove = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('home_bar_items').delete().eq('item_id', itemId);
      if (error) throw error;
    },
    onMutate: (itemId) => onMutateWith((ids) => ids.filter((i) => i !== itemId))(),
    onError: (_e, _id, ctx) => client.setQueryData(SHELF_KEY, ctx?.before),
    onSettled,
  });
  return { add, remove };
}

/** Glassware id to its icon key, for drawn placeholders. */
function useGlassIcons(): (id: string | null | undefined) => string | null {
  const { data: dropdowns } = useDropdowns();
  return useMemo(() => {
    const icons = new Map<string, string>();
    for (const g of (dropdowns?.glassware ?? []) as { id: string; name: string; icon_key?: string | null }[]) icons.set(g.id, g.icon_key || g.name);
    return (id) => (id ? (icons.get(id) ?? null) : null);
  }, [dropdowns?.glassware]);
}

/** Items the person can see, by id, in URL-sized batches (shelf names, hearted drinks). */
async function readItems(ids: string[], select = ITEM_SELECT): Promise<ItemRow[]> {
  const batches = await Promise.all(
    chunk(ids, 150).map(async (batch) => {
      const { data, error } = await supabase.from('app_item_presentation').select(select).in('id', batch);
      if (error) throw error;
      return (data ?? []) as unknown as ItemRow[];
    })
  );
  return batches.flat();
}

/** What the shelf makes, and what one or two more bottles would unlock, worked out on the server (my_bar_drinks). */
function useMatches(enabled = true) {
  return useQuery({
    queryKey: [...SHELF_KEY, 'matches', 2],
    enabled,
    queryFn: async (): Promise<MatchRow[]> => {
      const rows: MatchRow[] = [];
      for (;;) {
        const last = rows[rows.length - 1];
        const { data, error } = await supabase.rpc('my_bar_drinks', { p_after_name: last?.name ?? null, p_after_id: last?.id ?? null, p_limit: 1000, p_two_away: true });
        if (error) throw error;
        rows.push(...((data ?? []) as MatchRow[]));
        if ((data ?? []).length < 1000) return rows;
      }
    },
  });
}

/**
 * The preps your shelf can make that aren't on it yet, most-used first: My
 * Bar's "Make first". Under the shelf's key, so a shelf change refreshes it.
 */
export function useMadePreps() {
  return useQuery({
    queryKey: [...SHELF_KEY, 'preps'],
    queryFn: async (): Promise<MadePrep[]> => {
      const { data, error } = await supabase.rpc('my_bar_preps');
      if (error) throw error;
      return (data ?? []) as MadePrep[];
    },
  });
}

/**
 * House preps one ingredient away from the shelf ("Orgeat, needs almonds"):
 * Make first's "One thing short". Under the shelf's key, so a shelf change refreshes it.
 */
export function useShortPreps() {
  return useQuery({
    queryKey: [...SHELF_KEY, 'preps-short'],
    queryFn: async (): Promise<ShortPrep[]> => {
      const { data, error } = await supabase.rpc('my_bar_preps_short');
      if (error) throw error;
      return (data ?? []) as ShortPrep[];
    },
  });
}

/** A house prep's card facts: how long it keeps and takes, and what goes in it (item_prep, its recipe). */
export interface PrepDetail {
  keepsHours: number | null;
  /** "24 h drip", when the card says. */
  lead: string | null;
  /** Its recipe lines, in order: what a "you have" checklist names. */
  lines: { id: string; name: string; generic: boolean }[];
}

/**
 * Card facts for these preps (Make first, One thing short, your house preps'
 * use-by, what each lab bottle goes into, what Add to shopping puts on the
 * list), in URL-sized batches. A bought thing comes back with no lines.
 */
export function usePrepDetails(prepIds: readonly string[]) {
  const ids = [...new Set(prepIds)].sort();
  return useQuery({
    queryKey: ['prep-details', ids],
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Record<string, PrepDetail>> => {
      const out: Record<string, PrepDetail> = Object.fromEntries(ids.map((id) => [id, { keepsHours: null, lead: null, lines: [] }]));
      await Promise.all(
        chunk(ids, 150).map(async (batch) => {
          const [cards, lines] = await Promise.all([
            supabase.from('item_prep').select('item_id, shelf_life_hours, lead_time_note').in('item_id', batch),
            supabase
              .from('app_recipe_presentation')
              .select('recipe_item_id, display_ingredient_id, is_optional, sort_order, display_ingredient(name, ingredient_role)')
              .in('recipe_item_id', batch)
              .order('sort_order'),
          ]);
          if (cards.error) throw cards.error;
          if (lines.error) throw lines.error;
          for (const c of (cards.data ?? []) as { item_id: string; shelf_life_hours: number | null; lead_time_note: string | null }[]) {
            out[c.item_id] = { ...out[c.item_id], keepsHours: c.shelf_life_hours, lead: c.lead_time_note };
          }
          type Line = { recipe_item_id: string; display_ingredient_id: string | null; is_optional: boolean | null; display_ingredient: { name: string; ingredient_role: string | null } | null };
          for (const l of (lines.data ?? []) as unknown as Line[]) {
            if (!l.display_ingredient_id || !l.display_ingredient || l.is_optional) continue;
            out[l.recipe_item_id].lines.push({ id: l.display_ingredient_id, name: l.display_ingredient.name, generic: l.display_ingredient.ingredient_role === 'generic' });
          }
        })
      );
      return out;
    },
  });
}

/** What the bottle sheet says a bottle is: where it's from, and what its kind is a kind of ("Fernet, a kind of amaro"). */
export function useBottleFacts(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['bottle-facts', itemId],
    enabled: !!itemId,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<{ origin: string | null; kindOf: string | null }> => {
      const up = async (id: string) => {
        const { data, error } = await supabase.from('app_item_presentation').select('name, origin, generic_id').eq('id', id).maybeSingle();
        if (error) throw error;
        return data as { name: string; origin: string | null; generic_id: string | null } | null;
      };
      const item = await up(itemId!);
      const kind = item?.generic_id && item.generic_id !== itemId ? await up(item.generic_id) : null;
      const parent = kind?.generic_id && kind.generic_id !== item?.generic_id ? await up(kind.generic_id) : null;
      return { origin: item?.origin ?? null, kindOf: parent?.name ?? null };
    },
  });
}

/** The bottles you've finished, newest first, with their names: the bottle sheet's history and Your old bottles. */
export function useFinishedBottles() {
  return useQuery({
    queryKey: [...SHELF_KEY, 'finished'],
    queryFn: async (): Promise<FinishedBottle[]> => {
      const { data, error } = await supabase.from('home_bar_finished').select('id, item_id, bought_at, finished_at').order('finished_at', { ascending: false }).limit(500);
      if (error) throw error;
      const rows = (data ?? []) as { id: string; item_id: string; bought_at: string | null; finished_at: string }[];
      const names = new Map((rows.length ? await readItems([...new Set(rows.map((r) => r.item_id))], 'id, name') : []).map((r) => [r.id, r.name]));
      return rows.flatMap((r) => {
        const name = names.get(r.item_id);
        return name ? [{ id: r.id, itemId: r.item_id, name, boughtAt: r.bought_at, finishedAt: r.finished_at }] : [];
      });
    },
  });
}

/** "Finished it": off the shelf and into your old bottles, in one call (finish_bar_item). */
export function useFinishBottle() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.rpc('finish_bar_item', { p_item_id: itemId });
      if (error) throw error;
    },
    onMutate: (itemId) => {
      const before = client.getQueryData<string[]>(SHELF_KEY);
      client.setQueryData<string[]>(SHELF_KEY, (ids) => (ids ?? []).filter((i) => i !== itemId));
      return { before };
    },
    onError: (_e, _id, ctx) => client.setQueryData(SHELF_KEY, ctx?.before),
    onSettled: () => client.invalidateQueries({ queryKey: SHELF_KEY }),
  });
}

/**
 * What the shelf makes and what one or two more bottles would unlock,
 * without the shelf's own names: all the eight ball needs, so it never waits on them.
 * `enabled` false skips the fetch (a venue's menu has no home shelf).
 */
export function useBarDrinks(enabled = true) {
  const matches = useMatches(enabled);
  const glass = useGlassIcons();
  return useMemo(() => {
    const drink = (r: MatchRow): BarItem => ({
      id: r.id,
      name: r.name,
      type: 'cocktail',
      imageUrl: r.image_url,
      glass: glass(r.glassware_id),
      shelfUses: r.uses ?? undefined,
      from: r.from_name ? { name: r.from_name, logo: r.from_logo ?? null } : undefined,
      // Read only when there: older servers don't send these.
      served: r.served_count && r.served_at?.length ? { count: r.served_count, bars: r.served_at } : undefined,
      variation: r.spec_match === 'variation' ? specNoteText(r.spec_note) ?? 'a variation' : undefined,
    });
    const sorted = sortMatches(matches.data ?? [], drink);
    const bottle = (b: { id: string; name: string }): BarItem => ({ id: b.id, name: b.name, type: 'ingredient', imageUrl: null, glass: null });
    return {
      canMake: sorted.canMake,
      oneAway: sorted.oneAway.map((g) => ({ bottles: g.buy.map(bottle), drinks: g.drinks })),
      twoAway: sorted.twoAway.map((g) => ({ bottles: g.buy.map(bottle), drinks: g.drinks })),
      /** Shelf row id to the number of drinks you can make with it. */
      usedIn: sorted.usedIn,
      canMakeIds: new Set(sorted.canMake.map((d) => d.id)),
      isLoading: matches.isLoading,
      error: matches.error,
    };
  }, [matches.data, matches.isLoading, matches.error, glass]);
}

/** The shelf's bottles with what each is a kind of: the bottles, then the kinds' names. */
async function readShelf(ids: string[]): Promise<Omit<ShelfItem, 'uses' | 'section'>[]> {
  const [rows, added] = await Promise.all([
    readItems(ids, SHELF_SELECT),
    supabase.from('home_bar_items').select('item_id, added_at'),
  ]);
  if (added.error) throw added.error;
  const addedAt = new Map((added.data ?? []).map((r: { item_id: string; added_at: string }) => [r.item_id, r.added_at]));
  const kindIds = [...new Set(rows.map((r) => r.generic_id).filter((id): id is string => !!id))];
  const kindRows = kindIds.length ? await readItems(kindIds, 'id, name, generic_id') : [];
  const kinds = new Map(kindRows.map((k) => [k.id, k.name]));
  // The kinds' own kinds, so a Tanqueray (a London dry gin) also counts as a Gin in Add to your bar.
  const parentIds = [...new Set(kindRows.map((k) => k.generic_id).filter((id): id is string => !!id && !kinds.has(id)))];
  const parents = parentIds.length ? await readItems(parentIds, 'id, name') : [];
  const tree = new Map([...kindRows, ...parents].map((k) => [k.id, { name: k.name, parent: k.generic_id ?? null }]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.item_type,
    kindIds: r.ingredient_role === 'product' && r.generic_id ? kindsCovered(r.generic_id, tree) : undefined,
    imageUrl: heroPicture(r.item_images)?.url ?? null,
    glass: null,
    maker: r.brand_maker ?? null,
    abv: r.abv ?? null,
    kind: (r.generic_id && kinds.get(r.generic_id)) || null,
    role: r.ingredient_role ?? null,
    hasRecipe: !!r.recipes?.length,
    addedAt: addedAt.get(r.id) ?? null,
  }));
}

/** My Bar: the shelf, what it makes, and what one more bottle would unlock. */
export function useMyBar() {
  const shelf = useShelf();
  const drinks = useBarDrinks();
  const ids = shelf.data ?? NONE;
  const names = useQuery({
    queryKey: [...SHELF_KEY, 'items', ids],
    enabled: ids.length > 0,
    // The last shelf stays up while a changed one loads, so the list doesn't blank and jump on every tap.
    placeholderData: keepPreviousData,
    queryFn: () => readShelf(ids),
  });

  return useMemo(() => {
    const byId = new Map((names.data ?? []).map((r) => [r.id, r]));
    // The shelf in the order it was filled, as far as the person can still see it.
    const onShelf = ids.flatMap((id) => {
      const r = byId.get(id);
      // Worked out here, not saved, so a saved shelf from an older app still gets sorted.
      return r ? [{ ...r, uses: drinks.usedIn[id] ?? 0, section: barSection(r) }] : [];
    });
    return {
      shelf: onShelf,
      canMake: drinks.canMake,
      oneAway: drinks.oneAway,
      twoAway: drinks.twoAway,
      usedIn: drinks.usedIn,
      canMakeIds: drinks.canMakeIds,
      /** Everything on the shelf, before names load. */
      shelfIds: new Set(ids),
      isLoading: shelf.isLoading || drinks.isLoading || (ids.length > 0 && names.isLoading),
      error: shelf.error ?? drinks.error ?? names.error,
    };
  }, [ids, shelf.isLoading, shelf.error, drinks, names.data, names.isLoading, names.error]);
}

/**
 * The pantry staples (lib/pantry.ts) as shared ingredients, by name. A staple
 * the catalog doesn't have is left out.
 */
export function usePantryItems() {
  return useQuery({
    queryKey: ['pantry-items'],
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async (): Promise<{ name: string; id: string }[]> => {
      const names = [...PANTRY.map((p) => p.name), PANTRY_WATER];
      const { data, error } = await supabase
        .from('app_item_presentation')
        .select('id, name')
        .eq('item_type', 'ingredient')
        .is('bar_id', null)
        // Any letter case: catalog names went sentence case in 20261016750000.
        .or(names.map((n) => `name.ilike."${likeExactly(n).replace(/"/g, '\\"')}"`).join(','))
        .order('id');
      if (error) throw error;
      // One row per name (the shared list has one of each since 20261008100200).
      const byName = new Map<string, string>();
      for (const r of (data ?? []) as { id: string; name: string }[]) if (!byName.has(r.name.toLowerCase())) byName.set(r.name.toLowerCase(), r.id);
      return names.flatMap((name) => {
        const id = byName.get(name.toLowerCase());
        return id ? [{ name, id }] : [];
      });
    },
  });
}

/** These drinks, by id, as the person can see them (hearted drinks on Collection). */
export function useDrinksById(ids: readonly string[]) {
  const glass = useGlassIcons();
  const sorted = [...ids].sort();
  const query = useQuery({
    queryKey: ['drinks-by-id', sorted],
    enabled: sorted.length > 0,
    queryFn: () => readItems(sorted),
  });
  const drinks = useMemo(() => {
    const byId = new Map((query.data ?? []).filter((r) => r.item_type === 'cocktail').map((r) => [r.id, r]));
    return ids.flatMap((id) => {
      const r = byId.get(id);
      return r ? [{ id: r.id, name: r.name, type: 'cocktail' as const, imageUrl: heroPicture(r.item_images)?.url ?? null, glass: glass(r.glassware_id) }] : [];
    });
  }, [ids, query.data, glass]);
  return { drinks, isLoading: query.isLoading };
}

