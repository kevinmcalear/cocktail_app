import { useQuery } from '@tanstack/react-query';

import type { MenuDrinkSpec } from '@/lib/menuNote';
import { supabase } from '@/lib/supabase';

/** How a bar buys one ingredient, for the cost of a drink not saved yet. */
export interface DraftPack {
  itemId: string;
  supplier: string | null;
  amount: number | null;
  unit: string | null;
  /** Null until the bar sets a pack price, or when this role can't read costs (RLS). */
  costMinor: number | null;
}

/**
 * The packs and pack prices of the ingredients in a drink being made, at a
 * venue: what the desktop page's cost adds up while the spec is written.
 * Prices come back only with the costs capability (item_costs' policy).
 */
export function useDraftPacks(barId: string | null | undefined, itemIds: readonly string[], enabled = true) {
  const ids = [...new Set(itemIds)].sort();
  return useQuery({
    queryKey: ['draft-packs', barId, ids],
    enabled: !!barId && ids.length > 0 && enabled,
    queryFn: async (): Promise<DraftPack[]> => {
      const [packs, costs] = await Promise.all([
        supabase.from('item_purchasing').select('item_id, pack_size_amount, pack_size_unit, suppliers(name)').eq('bar_id', barId!).in('item_id', ids),
        supabase.from('item_costs').select('item_id, pack_cost_minor').eq('bar_id', barId!).in('item_id', ids),
      ]);
      if (packs.error) throw packs.error;
      if (costs.error) throw costs.error;
      const cost = new Map((costs.data ?? []).map((c) => [c.item_id as string, c.pack_cost_minor as number]));
      return (packs.data ?? []).map((p) => {
        const supplier = p.suppliers as { name: string } | { name: string }[] | null;
        return {
          itemId: p.item_id as string,
          supplier: (Array.isArray(supplier) ? supplier[0]?.name : supplier?.name) ?? null,
          amount: p.pack_size_amount as number | null,
          unit: p.pack_size_unit as string | null,
          costMinor: cost.get(p.item_id as string) ?? null,
        };
      });
    },
  });
}

/** The menu and section a new drink goes on ("Winter menu", "Long & bright"), for the page's header. */
export function useMenuSectionPlace(sectionId: string | null | undefined) {
  return useQuery({
    queryKey: ['menu-section-place', sectionId],
    enabled: !!sectionId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ menu: string | null; section: string | null } | null> => {
      const { data, error } = await supabase.from('menu_sections').select('name, menus(name)').eq('id', sectionId!).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const menu = data.menus as { name: string | null } | { name: string | null }[] | null;
      return { menu: (Array.isArray(menu) ? menu[0]?.name : menu?.name) ?? null, section: data.name ?? null };
    },
  });
}

/**
 * The other drinks on the menu a new drink is going on, with their specs as
 * the taste reads them (lib/menuNote): what the desktop page's one line about
 * the menu compares it with. Drinks with no spec (a beer, a wine) are left out.
 * ponytail: four reads, fine for a menu of a few dozen drinks.
 */
export function useMenuDrinkSpecs(sectionId: string | null | undefined) {
  return useQuery({
    queryKey: ['menu-drink-specs', sectionId],
    enabled: !!sectionId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MenuDrinkSpec[]> => {
      const section = await supabase.from('menu_sections').select('menu_id').eq('id', sectionId!).maybeSingle();
      if (section.error) throw section.error;
      if (!section.data) return [];
      const onMenu = await supabase.from('menu_drinks').select('item_id').eq('menu_id', section.data.menu_id);
      if (onMenu.error) throw onMenu.error;
      const drinkIds = [...new Set((onMenu.data ?? []).flatMap((r) => (r.item_id ? [r.item_id] : [])))];
      if (!drinkIds.length) return [];
      const [drinks, recipes] = await Promise.all([
        supabase.from('items').select('id, name').in('id', drinkIds),
        supabase.from('app_recipe_presentation').select('recipe_item_id, ingredient_item_id, amount, unit').in('recipe_item_id', drinkIds).limit(2000),
      ]);
      if (drinks.error) throw drinks.error;
      if (recipes.error) throw recipes.error;
      const ingIds = [...new Set((recipes.data ?? []).flatMap((r) => (r.ingredient_item_id ? [r.ingredient_item_id] : [])))];
      const ings = ingIds.length ? await supabase.from('items').select('id, name, generic_id').in('id', ingIds) : { data: [], error: null };
      if (ings.error) throw ings.error;
      const genericIds = [...new Set((ings.data ?? []).flatMap((i) => (i.generic_id ? [i.generic_id] : [])))];
      const generics = genericIds.length ? await supabase.from('items').select('id, name').in('id', genericIds) : { data: [], error: null };
      if (generics.error) throw generics.error;
      const ing = new Map((ings.data ?? []).map((i) => [i.id, i]));
      const generic = new Map((generics.data ?? []).map((g) => [g.id, g.name]));
      return (drinks.data ?? []).flatMap((d) => {
        const lines = (recipes.data ?? [])
          .filter((r) => r.recipe_item_id === d.id && r.ingredient_item_id && ing.has(r.ingredient_item_id))
          .map((r) => {
            const i = ing.get(r.ingredient_item_id!)!;
            return { name: i.name, genericName: (i.generic_id && generic.get(i.generic_id)) || null, amount: r.amount, unit: r.unit };
          });
        return lines.length ? [{ name: d.name, lines }] : [];
      });
    },
  });
}
