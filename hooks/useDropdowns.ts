import { useQuery, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { hasSharedCatalog, patchSharedCatalog, useIngredientCatalog } from '@/hooks/useIngredientCatalog';
import { allRows, allRowsById, byName } from '@/lib/allRows';
import { CATALOG_COLUMNS } from '@/lib/matchCatalog';
import { DROPDOWNS_QUERY_KEY, venueListOptions } from '@/lib/queryDefaults';
import { supabase } from '@/lib/supabase';

/** The prefix of every lookup list below (and useCurrentMenuDrinks): lib/queryDefaults.ts. */
export { DROPDOWNS_QUERY_KEY };

/**
 * Each list's own key. A write invalidates only the one it changed: the
 * whole prefix also reads the aliases and every venue's ingredients again.
 */
export const dropdownKeys = {
  /** Methods, glassware, families, ice, categories and menu templates. */
  specs: [...DROPDOWNS_QUERY_KEY, 'specs'],
  menus: [...DROPDOWNS_QUERY_KEY, 'menus'],
  ingredientExtras: [...DROPDOWNS_QUERY_KEY, 'ingredient-extras'],
  /** useCurrentMenuDrinks: drinks on current menus, whatever the menu ids. */
  currentMenuDrinks: [...DROPDOWNS_QUERY_KEY, 'current_menu_drinks'],
} as const;

/** What the spec pickers, badges and drink facts read from a method, glass, family or ice row. */
const SPEC_COLUMNS = 'id, name, item_type, bar_id, icon_key, icon_url, capacity_ml, iced_capacity_ml';

/** Methods, glassware, families, ice and categories: small, and on most screens. */
function useSpecLists() {
  return useQuery({
    queryKey: dropdownKeys.specs,
    // Small (a few hundred rows) and read on a drink's first paint: saved between
    // launches. Fresh for a day (lib/queryTiers.ts); a write here refreshes it.
    meta: { persist: true },
    queryFn: async () => {
      // A request stops at 1,000 rows, so page (a new "Freezer pour" method once sorted past it).
      const [rows, categoriesRes, kindsRes] = await Promise.all([
        allRows((from, to) =>
          supabase
            .from('app_item_presentation')
            .select(SPEC_COLUMNS)
            .in('item_type', ['method', 'glassware', 'family', 'ice'])
            .order('name')
            .order('id')
            .range(from, to)
        ),
        supabase.from('categories').select('*').order('name'),
        // A glass's or an ice's kind (items.glass, items.ice_kind): the view doesn't carry it, and without it the name is read.
        // ponytail: one read more, a few dozen rows; add the two columns to app_item_presentation with the next migration and drop it.
        supabase.from('items').select('id, glass, ice_kind').in('item_type', ['glassware', 'ice']).or('glass.not.is.null,ice_kind.not.is.null'),
      ]);
      const kinds = new Map((kindsRes.data ?? []).map((k) => [k.id, k]));
      const specs = rows.map((r) => ({ ...r, glass: kinds.get(r.id)?.glass ?? null, ice_kind: kinds.get(r.id)?.ice_kind ?? null }));
      return {
        methods: specs.filter((item) => item.item_type === 'method'),
        glassware: specs.filter((item) => item.item_type === 'glassware'),
        families: specs.filter((item) => item.item_type === 'family'),
        // The shared ice. A venue's own ice items (item_ice) are its Kit, read with useVenueIce.
        // ponytail: drinks name the shared ice until the wizard offers the venue's own (kit and ice PR 6).
        iceTypes: specs.filter((item) => item.item_type === 'ice' && !item.bar_id),
        categories: categoriesRes.data || [],
      };
    },
  });
}

/** The prefix of the ingredient lists: a venue's (useVenueIngredients), by id, and the catalog's own rows (hooks/useIngredientCatalog). */
export const INGREDIENTS_KEY = [...DROPDOWNS_QUERY_KEY, 'ingredients'] as const;

/** The columns the Library's venue ingredient lists read. */
const INGREDIENT_COLUMNS = `id, name, item_type, generic_id, description, brand_maker, bar_id, hide_from_search, created_at, ingredient_role,
  item_images ( sort_order, is_generated, images ( url ) ),
  item_categories ( category_id )`;

/**
 * Every ingredient anyone can pick (~20,000 rows), for the editors' pickers
 * and home search: the slim catalog (hooks/useIngredientCatalog), saved on
 * the device, in name order. Undefined until it's here.
 */
export function useAllIngredients(enabled = true) {
  const { rows, error } = useIngredientCatalog(enabled);
  return { data: rows, isLoading: enabled && !rows && !error, error };
}

/**
 * A venue's own ingredients with their pictures and tags, for the Library at
 * that venue: a few hundred rows, saved between launches.
 * Paged by id (each page starts after the last), then sorted by name here:
 * a name-ordered offset page made the server build and sort every
 * ingredient again, so each page was as slow as the whole list.
 */
export function useVenueIngredients(barIds: readonly string[], enabled = true) {
  const scoped = venueListOptions(barIds);
  return useQuery({
    queryKey: [...INGREDIENTS_KEY, 'bars', barIds],
    ...scoped,
    enabled: enabled && scoped.enabled !== false,
    queryFn: async () =>
      (
        await allRowsById((after, size) => {
          const page = supabase.from('app_item_presentation').select(INGREDIENT_COLUMNS).eq('item_type', 'ingredient').in('bar_id', barIds);
          return (after ? page.gt('id', after) : page).order('id').limit(size);
        })
      ).sort(byName),
  });
}

/**
 * Just these ingredients, in name order (the shared ones a venue's drinks
 * use), instead of the whole list. Saved between launches.
 */
export function useIngredientsById(ids: readonly string[]) {
  const sorted = useMemo(() => [...new Set(ids)].sort(), [ids]);
  return useQuery({
    queryKey: [...INGREDIENTS_KEY, 'ids', sorted],
    ...venueListOptions(sorted),
    queryFn: async () => {
      // ~200 ids per request keeps the URL well under PostgREST's limit.
      const pages = await Promise.all(
        Array.from({ length: Math.ceil(sorted.length / 200) }, (_, i) =>
          supabase.from('app_item_presentation').select(INGREDIENT_COLUMNS).in('id', sorted.slice(i * 200, i * 200 + 200))
        )
      );
      const failed = pages.find((p) => p.error);
      if (failed) throw failed.error;
      return pages.flatMap((p) => p.data ?? []).sort(byName);
    },
  });
}

/**
 * After ingredients are saved, created or deleted: the venues' own lists and
 * yours read again (small), and just those rows re-read into the shared
 * catalog (dropping any that are gone) in one request, instead of
 * downloading it again.
 */
export async function refreshIngredients(client: QueryClient, ids: string[]) {
  if (!ids.length) return;
  void client.invalidateQueries({ queryKey: INGREDIENTS_KEY });
  if (!hasSharedCatalog(client)) return;
  const { data, error } = await supabase.from('app_item_presentation').select(`${CATALOG_COLUMNS}, created_by`).in('id', ids);
  // ponytail: a failed read leaves the shared catalog as it was until its day is up; only admins change shared rows.
  if (!error) patchSharedCatalog(client, ids, (data ?? []).flatMap((r) => (r.id ? [{ ...r, id: r.id }] : [])));
}

/** Every menu the person can read, for search and Prep. Tonight uses useVenueMenus. */
function useAllMenus(enabled: boolean) {
  return useQuery({
    queryKey: dropdownKeys.menus,
    enabled,
    queryFn: async () => {
      // ponytail: every menu; Prep filters is_active
      const { data, error } = await supabase
        .from('menus')
        .select('id, name, bar_id, is_active, created_at, cover_url, cover_position')
        .order('created_at');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * One of each ingredient (20261008100000): other names, and the core list
 * pickers put first. Either may be missing on a database without that
 * migration; pickers then work as before. Loaded with the ingredient list.
 */
export function useIngredientExtras(enabled: boolean) {
  return useQuery({
    queryKey: dropdownKeys.ingredientExtras,
    enabled,
    meta: { persist: false },
    queryFn: async () => {
      // A page at a time: the server sends 1,000 rows at most, and there are thousands of aliases
      // (one past the first 1,000 left "Del Maguey Vida mezcal" a new bottle in a pasted spec).
      const [aliases, core] = await Promise.all([
        allRows((from, to) => supabase.from('ingredient_aliases').select('key, item_id').order('key').range(from, to)).catch(() => []),
        allRowsById<{ id: string }>((after, size) => {
          const page = supabase.from('items').select('id').eq('is_core', true);
          return (after ? page.gt('id', after) : page).order('id').limit(size);
        }).catch(() => []),
      ]);
      return {
        ingredientAliases: aliases,
        coreIngredientIds: core.map((r) => r.id),
      };
    },
  });
}

/**
 * The lookup lists editors and drink pages read. Spec lists always; the
 * whole ingredient list (with its aliases and core list) and every menu only
 * when asked, since they're big (ingredients) or only for the creator
 * screens (menus).
 */
export function useDropdowns({ ingredients: withIngredients = false, menus: withMenus = false }: { ingredients?: boolean; menus?: boolean } = {}) {
  const specs = useSpecLists();
  const ingredients = useAllIngredients(withIngredients);
  const extras = useIngredientExtras(withIngredients);
  const menus = useAllMenus(withMenus);
  // Spec badges and pickers don't wait on the ingredient download: `ingredients`
  // stays undefined until it lands (pickers show it's loading, not "no results").
  const ready = !!specs.data && (!withMenus || !!menus.data);
  const data = useMemo(
    () => (ready ? { ...specs.data!, ...extras.data, ingredients: ingredients.data, menus: menus.data } : undefined),
    [ready, specs.data, extras.data, ingredients.data, menus.data]
  );
  const isLoading = specs.isLoading || (withIngredients && ingredients.isLoading) || (withMenus && menus.isLoading);
  return { data, isLoading };
}
