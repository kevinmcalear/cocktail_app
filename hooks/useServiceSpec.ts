import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ServiceStyle } from '@/lib/service';
import type { PresentationRecipe } from '@/lib/spec';
import { supabase } from '@/lib/supabase';

interface CachedDrink {
  service_style?: string | null;
  recipes?: (PresentationRecipe & { id?: string })[] | null;
}

/**
 * Decide where a spec line goes: in the batch (false) or added at the station
 * (true). Writes recipes.at_service, which the drink's own edit policy guards,
 * and updates the open drink page straight away.
 */
export function useSetLineService(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, atService }: { key: string; atService: boolean }) => {
      const { error } = await supabase.from('recipes').update({ at_service: atService }).eq('id', key);
      if (error) throw error;
    },
    onMutate: ({ key, atService }) => {
      queryClient.setQueriesData<CachedDrink | null>({ queryKey: ['cocktail', itemId] }, (old) =>
        old ? { ...old, recipes: old.recipes?.map((r) => (r.id === key ? { ...r, at_service: atService } : r)) } : old
      );
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['cocktail', itemId] }),
  });
}

/** How the drink is served (items.service_style), or null to clear it. */
export function useSetServiceStyle(itemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (style: ServiceStyle | null) => {
      const { error } = await supabase.from('items').update({ service_style: style }).eq('id', itemId);
      if (error) throw error;
    },
    onMutate: (style) => {
      queryClient.setQueriesData<CachedDrink | null>({ queryKey: ['cocktail', itemId] }, (old) => (old ? { ...old, service_style: style } : old));
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['cocktail', itemId] }),
  });
}

export interface StationDrink {
  id: string;
  name: string;
  glassware_id: string | null;
  ice_id: string | null;
  service_style: string | null;
  methodIds: string[];
  recipes: PresentationRecipe[];
}

interface MenuDrinkRow {
  item_id: string;
  sort_order: number | null;
}

interface ItemRow {
  id: string;
  name: string;
  item_type: string;
  glassware_id: string | null;
  ice_id: string | null;
  service_style: string | null;
  item_methods: { method_item_id: string }[] | null;
}

/**
 * Every cocktail on the given menus with what the station sheet needs: how
 * it's served, its method, glass and ice ids, and its spec rows (masked by
 * role on the server, at_service with the amounts). Menu order, one row per
 * drink.
 */
export function useStationSheet(barId: string | null | undefined, menuIds: string[]) {
  const key = [...menuIds].sort();
  return useQuery({
    queryKey: ['station-sheet', barId, key],
    enabled: !!barId && key.length > 0,
    queryFn: async (): Promise<StationDrink[]> => {
      const menuRes = await supabase.from('menu_drinks').select('item_id, sort_order').in('menu_id', key).order('sort_order');
      if (menuRes.error) throw menuRes.error;
      const ids = [...new Set(((menuRes.data ?? []) as MenuDrinkRow[]).map((r) => r.item_id))];
      if (!ids.length) return [];
      const [itemRes, recipeRes] = await Promise.all([
        supabase
          .from('app_item_presentation')
          .select('id, name, item_type, glassware_id, ice_id, service_style, item_methods!item_methods_item_id_fkey(method_item_id)')
          .in('id', ids),
        supabase
          .from('app_recipe_presentation')
          .select('id, recipe_item_id, sort_order, created_at, amount, unit, at_service, display_ingredient_id, display_ingredient(id, name)')
          .in('recipe_item_id', ids),
      ]);
      if (itemRes.error) throw itemRes.error;
      if (recipeRes.error) throw recipeRes.error;
      const items = new Map(((itemRes.data ?? []) as unknown as ItemRow[]).map((i) => [i.id, i]));
      const recipes = (recipeRes.data ?? []) as unknown as (PresentationRecipe & { recipe_item_id: string })[];
      return ids.flatMap((id) => {
        const item = items.get(id);
        if (!item || item.item_type !== 'cocktail') return [];
        return [
          {
            id,
            name: item.name,
            glassware_id: item.glassware_id,
            ice_id: item.ice_id,
            service_style: item.service_style,
            methodIds: (item.item_methods ?? []).map((m) => m.method_item_id),
            recipes: recipes.filter((r) => r.recipe_item_id === id),
          },
        ];
      });
    },
  });
}
