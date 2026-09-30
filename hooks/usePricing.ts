import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

export interface PricingSettings {
  currency: string | null;
  tax_rate: number;
  prices_include_tax: boolean;
  target_gp: number | null;
}

const SETTINGS_COLUMNS = 'currency, tax_rate, prices_include_tax, target_gp';

/** The bar's currency, tax and target GP (bars.*); readable by its members. */
export function usePricingSettings(barId: string | null | undefined) {
  return useQuery({
    queryKey: ['pricing-settings', barId],
    enabled: !!barId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PricingSettings | null> => {
      const { data, error } = await supabase.from('bars').select(SETTINGS_COLUMNS).eq('id', barId!).maybeSingle();
      if (error) throw error;
      return (data as PricingSettings | null) ?? null;
    },
  });
}

/** Admins set the pricing settings. */
export function useSetPricingSettings(barId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: PricingSettings) => {
      const { error } = await supabase.from('bars').update(settings).eq('id', barId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pricing-settings', barId] });
      void queryClient.invalidateQueries({ queryKey: ['item-purchase'] });
      void queryClient.invalidateQueries({ queryKey: ['drink-cost'] });
    },
  });
}

export interface Supplier {
  id: string;
  name: string;
}

export interface ItemPurchase {
  /** item_purchasing: the pack and who sells it. Null until set. */
  pack: { supplier_id: string | null; pack_size_amount: number | null; pack_size_unit: string | null } | null;
  /** item_costs: the pack price. Null until set, or when this role can't read costs. */
  cost: { pack_cost_minor: number; updated_at: string } | null;
  suppliers: Supplier[];
}

/** How a bar buys an ingredient: pack, supplier and price. Costs come back only with the costs capability (RLS). */
export function useItemPurchase(itemId: string | null | undefined, barId: string | null | undefined) {
  return useQuery({
    queryKey: ['item-purchase', barId, itemId],
    enabled: !!itemId && !!barId,
    queryFn: async (): Promise<ItemPurchase> => {
      const [pack, cost, suppliers] = await Promise.all([
        supabase.from('item_purchasing').select('supplier_id, pack_size_amount, pack_size_unit').eq('bar_id', barId!).eq('item_id', itemId!).maybeSingle(),
        supabase.from('item_costs').select('pack_cost_minor, updated_at').eq('bar_id', barId!).eq('item_id', itemId!).maybeSingle(),
        supabase.from('suppliers').select('id, name').eq('bar_id', barId!).order('name'),
      ]);
      if (pack.error) throw pack.error;
      if (cost.error) throw cost.error;
      if (suppliers.error) throw suppliers.error;
      return { pack: pack.data ?? null, cost: cost.data ?? null, suppliers: (suppliers.data ?? []) as Supplier[] };
    },
  });
}

export interface ItemPurchaseInput {
  packAmount: number | null;
  packUnit: string | null;
  /** An existing supplier's id, or a new supplier's name to add, or null. */
  supplier: { id: string } | { name: string } | null;
  /** The pack price in minor units; null leaves the cost row alone (or removes it when `clearCost`). */
  packCostMinor: number | null;
  clearCost?: boolean;
}

/** Save how a bar buys an ingredient: the pack and supplier (prep or costs), and the pack price (costs only). */
export function useSaveItemPurchase(itemId: string, barId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ItemPurchaseInput) => {
      let supplierId: string | null = null;
      if (input.supplier && 'id' in input.supplier) supplierId = input.supplier.id;
      else if (input.supplier && input.supplier.name.trim()) {
        const { data, error } = await supabase.from('suppliers').insert({ bar_id: barId, name: input.supplier.name.trim() }).select('id').single();
        if (error) throw error;
        supplierId = data.id;
      }
      const pack = await supabase
        .from('item_purchasing')
        .upsert({ bar_id: barId, item_id: itemId, supplier_id: supplierId, pack_size_amount: input.packAmount, pack_size_unit: input.packAmount ? input.packUnit : null }, { onConflict: 'bar_id,item_id' });
      if (pack.error) throw pack.error;
      if (input.packCostMinor != null) {
        const cost = await supabase.from('item_costs').upsert({ bar_id: barId, item_id: itemId, pack_cost_minor: input.packCostMinor, updated_at: new Date().toISOString() }, { onConflict: 'bar_id,item_id' });
        if (cost.error) throw cost.error;
      } else if (input.clearCost) {
        const gone = await supabase.from('item_costs').delete().eq('bar_id', barId).eq('item_id', itemId);
        if (gone.error) throw gone.error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['item-purchase', barId, itemId] });
      void queryClient.invalidateQueries({ queryKey: ['priced-items', barId] });
      void queryClient.invalidateQueries({ queryKey: ['prep-data'] });
      void queryClient.invalidateQueries({ queryKey: ['drink-cost'] });
    },
  });
}

/** The ingredients this bar has a pack price for, so the Library can show the ones that still need one. */
export function usePricedItemIds(barId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['priced-items', barId],
    enabled: !!barId && enabled,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('item_costs').select('item_id').eq('bar_id', barId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.item_id as string);
    },
  });
}
