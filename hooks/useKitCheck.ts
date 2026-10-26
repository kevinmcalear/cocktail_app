import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useBarGlassware } from '@/hooks/useBarGlassware';
import { useBarKit } from '@/hooks/useBarKit';
import { useHomeGlassware, useHomeIce } from '@/hooks/useHomeKit';
import { useKit } from '@/hooks/useKit';
import { useVenueIce } from '@/hooks/useVenueIce';
import { kitCheck, type CheckDrink, type CheckKit, type KitCheck } from '@/lib/kitCheck';
import { supabase } from '@/lib/supabase';

// The kit check's data (lib/kitCheck.ts): a drink's glass, ice and methods by
// name, and the venue's Kit with the recipes of the ice it makes. Recipes are
// read as house preps are, so without Prep at the venue an ice's own tools
// aren't followed.

const DRINK_COLUMNS = 'id, glass:glassware_id(name), ice:ice_id(name), method_ice:method_ice_id(name), ice_build, item_methods!item_methods_item_id_fkey(method:method_item_id(name))';

type DrinkRow = {
  id: string;
  glass: { name: string } | null;
  ice: { name: string } | null;
  method_ice: { name: string } | null;
  ice_build: { ice?: unknown }[] | null;
  item_methods: { method: { name: string } | null }[];
};

export type CheckedDrink = CheckDrink & { id: string };

/** A build's layers are ice item ids (lib/iceBuild.ts toStored). */
const layerIds = (r: DrinkRow) => (Array.isArray(r.ice_build) ? r.ice_build : []).flatMap((l) => (typeof l.ice === 'string' ? [l.ice] : []));

/** The drinks as the check reads them, their builds' ice by name (one read for every layer). */
async function drinksOf(rows: DrinkRow[]): Promise<CheckedDrink[]> {
  const ids = [...new Set(rows.flatMap(layerIds))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data, error } = await supabase.from('items').select('id, name').in('id', ids);
    if (error) throw error;
    for (const i of data ?? []) names.set(i.id, i.name);
  }
  return rows.map((r) => drinkOf(r, names));
}

/** A drink row as the check reads it: every ice layer (else its one ice) and what it's shaken or stirred with. */
function drinkOf(r: DrinkRow, names: ReadonlyMap<string, string>): CheckedDrink {
  const layers = layerIds(r).flatMap((id) => (names.has(id) ? [names.get(id)!] : []));
  return {
    id: r.id,
    glass: r.glass?.name ?? null,
    ice: [...(layers.length ? layers : r.ice ? [r.ice.name] : []), ...(r.method_ice ? [r.method_ice.name] : [])],
    methods: r.item_methods.flatMap((m) => (m.method ? [m.method.name] : [])),
  };
}

/** The venue's drinks as the check reads them. */
export function useVenueDrinks(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['venue-drink-kit', barId],
    enabled: !!barId,
    // A minute: drink saves don't refresh it, so a changed or new drink is checked again soon after.
    staleTime: 60_000,
    queryFn: async (): Promise<CheckedDrink[]> => {
      // ponytail: one page of a venue's drinks; past 1000 the rest aren't checked. A paged read if a venue gets there.
      const { data, error } = await supabase.from('items').select(DRINK_COLUMNS).eq('bar_id', barId!).eq('item_type', 'cocktail').limit(1000);
      if (error) throw error;
      return drinksOf((data ?? []) as unknown as DrinkRow[]);
    },
  });
}

/** One drink as the check reads it (a catalog drink seen at a venue too). */
function useDrink(itemId: string) {
  return useQuery({
    queryKey: ['drink-kit', itemId],
    // Short: a drink changed on its own page should check again when it's opened.
    staleTime: 30_000,
    queryFn: async (): Promise<CheckedDrink | null> => {
      const { data, error } = await supabase.from('items').select(DRINK_COLUMNS).eq('id', itemId).maybeSingle();
      if (error) throw error;
      return data ? ((await drinksOf([data as unknown as DrinkRow]))[0] ?? null) : null;
    },
  });
}

/** The venue's ice it makes: the tools each one's steps name, and the ice it starts from. */
export function useIceRecipes(barId: string | null | undefined, ids: readonly string[]) {
  return useQuery({
    queryKey: ['venue-ice-recipes', barId, ids],
    enabled: !!barId && ids.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const [steps, lines] = await Promise.all([
        supabase.from('item_steps').select('item_id, equipment').in('item_id', ids),
        supabase.from('recipes').select('recipe_item_id, ingredient_item_id').in('recipe_item_id', ids),
      ]);
      if (steps.error) throw steps.error;
      if (lines.error) throw lines.error;
      return ids.map((id) => ({
        id,
        tools: (steps.data ?? []).filter((s) => s.item_id === id).flatMap((s) => s.equipment),
        // The first line that is another of the venue's ice: what it starts from.
        from: (lines.data ?? []).find((l) => l.recipe_item_id === id && l.ingredient_item_id && ids.includes(l.ingredient_item_id))?.ingredient_item_id ?? null,
      }));
    },
  });
}

/** The venue's Kit as the check reads it; null while it loads, or with no venue. */
export function useVenueKit(barId: string | null | undefined): CheckKit | null {
  const glasses = useBarGlassware(barId).data;
  const ice = useVenueIce(barId).data;
  const tools = useBarKit(barId).data;
  const made = (ice ?? []).filter((i) => i.source === 'made').map((i) => i.id);
  const recipes = useIceRecipes(barId, made).data;
  return useMemo(() => {
    if (!barId || !glasses || !ice || !tools) return null;
    return {
      glasses,
      ice,
      tools: tools.flatMap((t) => (t.key ? [t.key] : [])),
      recipes: new Map((recipes ?? []).map((r) => [r.id, { tools: r.tools, from: r.from }])),
    };
  }, [barId, glasses, ice, tools, recipes]);
}

const NO_RECIPES: CheckKit['recipes'] = new Map();

/** My Bar's kit as the check reads it (Kit and ice, step 13); null while it loads. Ice at home has no recipe, so its tools aren't followed. */
function useHomeCheckKit(): CheckKit | null {
  const glasses = useHomeGlassware().data;
  const ice = useHomeIce().data;
  const tools = useKit().owned;
  return useMemo(() => (glasses && ice ? { glasses, ice, tools, recipes: NO_RECIPES } : null), [glasses, ice, tools]);
}

/** Can you make this drink with My Bar's kit; null while it loads. */
export function useHomeDrinkKitCheck(itemId: string): KitCheck | null {
  const kit = useHomeCheckKit();
  const drink = useDrink(itemId).data;
  return useMemo(() => (kit && drink ? kitCheck(drink, kit) : null), [kit, drink]);
}

/** Every drink of the venue, checked, by id (Library's Ready here / Needs something). */
export function useVenueKitChecks(barId: string | null | undefined): ReadonlyMap<string, KitCheck> | null {
  const kit = useVenueKit(barId);
  const drinks = useVenueDrinks(barId).data;
  return useMemo(() => (kit && drinks ? new Map(drinks.map((d) => [d.id, kitCheck(d, kit)])) : null), [kit, drinks]);
}

const NO_SHELVES = { ready: [], needs: [], needsOf: () => null };

/** Library's Ready here and Needs something: the venue's cocktails by the kit check, and what each needs. */
export function useKitShelves<T extends { id: string; category?: string | null }>(barId: string | null | undefined, items: readonly T[]) {
  const checks = useVenueKitChecks(barId);
  return useMemo(() => {
    if (!checks) return NO_SHELVES as { ready: T[]; needs: T[]; needsOf: (id: string) => string | null };
    const cocktails = items.filter((i) => i.category === 'Cocktail' && checks.has(i.id));
    return {
      ready: cocktails.filter((i) => checks.get(i.id)!.ready),
      needs: cocktails.filter((i) => !checks.get(i.id)!.ready),
      needsOf: (id: string) => checks.get(id)?.needs ?? null,
    };
  }, [checks, items]);
}
