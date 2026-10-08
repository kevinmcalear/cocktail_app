import { useQuery, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { allRows, allRowsById, byName, withRow } from '@/lib/allRows';
import { DROPDOWNS_QUERY_KEY } from '@/lib/queryDefaults';
import { supabase } from '@/lib/supabase';

/** The prefix of every lookup list below (and useCurrentMenuDrinks): lib/queryDefaults.ts. */
export { DROPDOWNS_QUERY_KEY };

/**
 * Each list's own key. A write invalidates only the one it changed: the
 * whole prefix also refetches the ingredient list (~14,000 rows).
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

/** Methods, glassware, families, ice, categories and menu templates: small, and on most screens. */
function useSpecLists() {
  return useQuery({
    queryKey: dropdownKeys.specs,
    // Small (a few hundred rows) and read on a drink's first paint: saved between
    // launches. Fresh for a day (lib/queryTiers.ts); a write here refreshes it.
    meta: { persist: true },
    queryFn: async () => {
      // A request stops at 1,000 rows, so page (a new "Freezer pour" method once sorted past it).
      const [specs, templatesRes, sectionsRes, categoriesRes] = await Promise.all([
        allRows((from, to) =>
          supabase
            .from('app_item_presentation')
            .select(SPEC_COLUMNS)
            .in('item_type', ['method', 'glassware', 'family', 'ice'])
            .order('name')
            .order('id')
            .range(from, to)
        ),
        supabase.from('menu_templates').select('*').order('name'),
        supabase.from('template_sections').select('*').order('sort_order'),
        supabase.from('categories').select('*').order('name'),
      ]);
      return {
        methods: specs.filter((item) => item.item_type === 'method'),
        glassware: specs.filter((item) => item.item_type === 'glassware'),
        families: specs.filter((item) => item.item_type === 'family'),
        iceTypes: specs.filter((item) => item.item_type === 'ice'),
        menuTemplates: templatesRes.data || [],
        templateSections: sectionsRes.data || [],
        categories: categoriesRes.data || [],
      };
    },
  });
}

/** The ingredient list's key (useAllIngredients), for optimistic updates. */
export const INGREDIENTS_KEY = [...DROPDOWNS_QUERY_KEY, 'ingredients'] as const;

/** The columns an ingredient picker and the Library's ingredient list read. */
const INGREDIENT_COLUMNS = `id, name, item_type, generic_id, description, brand_maker, bar_id, hide_from_search, created_at,
  item_images ( sort_order, is_generated, images ( url ) ),
  item_categories ( category_id )`;

/**
 * Every ingredient anyone can pick (~5,400 rows, several requests), for the
 * editors' pickers, the Library and the Creator Hub, which share this one
 * download. Only screens that need the whole list ask for it; searches go
 * to the server. Too big to save between launches.
 * ponytail: the legacy editors build trees from the whole list; move them to
 * a server search (like Search's ingredients) when the catalog passes ~20,000.
 */
export function useAllIngredients({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: INGREDIENTS_KEY,
    enabled,
    meta: { persist: false },
    // By id, a page after the last id (an offset page re-sorts every row
    // before it), then into name order here.
    queryFn: async () =>
      (
        await allRowsById((after, size) => {
          let page = supabase.from('app_item_presentation').select(INGREDIENT_COLUMNS).eq('item_type', 'ingredient');
          if (after) page = page.gt('id', after);
          return page.order('id').limit(size);
        })
      ).sort(byName),
  });
}

/**
 * After ingredients are saved, created or deleted: re-reads just those rows
 * into the loaded ingredient list (dropping any that are gone) in one
 * request, instead of downloading the whole list again.
 */
export async function refreshIngredients(client: QueryClient, ids: string[]) {
  if (!ids.length || !client.getQueryData(INGREDIENTS_KEY)) return;
  const { data, error } = await supabase.from('app_item_presentation').select(INGREDIENT_COLUMNS).in('id', ids);
  if (error) {
    await client.invalidateQueries({ queryKey: INGREDIENTS_KEY });
    return;
  }
  type Row = NonNullable<typeof data>[number];
  client.setQueryData<Row[]>(INGREDIENTS_KEY, (old) =>
    old && ids.reduce((rows, id) => withRow(rows, id, data.find((r) => r.id === id) ?? null), old)
  );
}

/** Every menu the person can read, for the legacy creator screens and Prep. Tonight uses useVenueMenus. */
function useAllMenus(enabled: boolean) {
  return useQuery({
    queryKey: dropdownKeys.menus,
    enabled,
    queryFn: async () => {
      // ponytail: every menu; Current filters is_active (inactive stay in the creator tree)
      const { data, error } = await supabase
        .from('menus')
        .select('id, name, template_id, bar_id, is_active, created_at, cover_url, cover_position')
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
function useIngredientExtras(enabled: boolean) {
  return useQuery({
    queryKey: dropdownKeys.ingredientExtras,
    enabled,
    meta: { persist: false },
    queryFn: async () => {
      const [aliases, core] = await Promise.all([
        supabase.from('ingredient_aliases').select('key, item_id').range(0, 9999),
        supabase.from('items').select('id').eq('is_core', true).range(0, 9999),
      ]);
      return {
        ingredientAliases: aliases.error ? [] : (aliases.data ?? []),
        coreIngredientIds: core.error ? [] : (core.data ?? []).map((r) => r.id as string),
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
  const ingredients = useAllIngredients({ enabled: withIngredients });
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
