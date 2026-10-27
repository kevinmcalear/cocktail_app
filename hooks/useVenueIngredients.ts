import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { VenueIngredient } from '@/lib/suppliers';
import { supabase } from '@/lib/supabase';

const chunks = <T,>(xs: readonly T[], n = 100) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export const venueIngredientsKey = (barId: string | null) => ['venue-ingredients', barId] as const;

/**
 * What a venue uses and buys: the ingredients of its drinks and preps, and
 * whatever it has a purchasing row for, each with its maker and supplier.
 * For people with Prep or Costs (purchasing is theirs).
 * ponytail: three reads plus one per 100 items, fine for a settings page; an
 * RPC if a venue's drinks outgrow one 1,000-row read.
 */
export function useVenueIngredients(barId: string | null) {
  return useQuery({
    queryKey: venueIngredientsKey(barId),
    enabled: !!barId,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<VenueIngredient[]> => {
      const [drinksRes, boughtRes] = await Promise.all([
        supabase.from('items').select('recipes:app_recipe_presentation!recipe_item_id(ingredient_item_id)').eq('bar_id', barId!).limit(1000),
        supabase.from('item_purchasing').select('item_id, supplier_id').eq('bar_id', barId!).limit(1000),
      ]);
      if (drinksRes.error) throw drinksRes.error;
      if (boughtRes.error) throw boughtRes.error;
      const used = new Set<string>();
      for (const d of drinksRes.data ?? []) for (const r of d.recipes ?? []) if (r.ingredient_item_id) used.add(r.ingredient_item_id);
      const supplier = new Map((boughtRes.data ?? []).map((r: { item_id: string; supplier_id: string | null }) => [r.item_id, r.supplier_id]));
      const out: VenueIngredient[] = [];
      for (const part of chunks([...new Set([...used, ...supplier.keys()])])) {
        const { data, error } = await supabase.from('items').select('id, name, item_type, ingredient_role, maker_profile_id').in('id', part);
        if (error) throw error;
        type Item = { id: string; name: string; item_type: string; ingredient_role: string | null; maker_profile_id: string | null };
        for (const i of (data ?? []) as Item[]) {
          // A block or slab an ice starts from is the venue's ice (Kit), not an ingredient in use.
          if (i.item_type === 'ice') continue;
          out.push({ id: i.id, name: i.name, type: i.item_type, role: i.ingredient_role, makerId: i.maker_profile_id, supplierId: supplier.get(i.id) ?? null, used: used.has(i.id) });
        }
      }
      return out.sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

/** Give some ingredients to one supplier. Their pack sizes and order codes stay as they are. */
export function useGiveToSupplier(barId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ supplierId, itemIds }: { supplierId: string; itemIds: string[] }) => {
      const { error } = await supabase
        .from('item_purchasing')
        .upsert(itemIds.map((item_id) => ({ bar_id: barId, item_id, supplier_id: supplierId })), { onConflict: 'bar_id,item_id' });
      if (error) throw error;
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: venueIngredientsKey(barId) });
      void client.invalidateQueries({ queryKey: ['venue-suppliers', barId] });
      void client.invalidateQueries({ queryKey: ['item-purchase', barId] });
      void client.invalidateQueries({ queryKey: ['prep-data'] });
    },
  });
}
