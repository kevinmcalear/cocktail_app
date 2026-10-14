import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { venueRegions } from '@/lib/suppliers';

// Who a venue orders from (suppliers, supabase/migrations/20260926150300_prep_and_purchasing.sql
// and 20261019000000_venue_kit.sql): private to people with Prep or Costs.
// Row shapes are written by hand until types/ is regenerated.

export interface VenueSupplier {
  id: string;
  name: string;
  website: string | null;
  order_notes: string | null;
  supplies: string[];
  order_by: string | null;
  delivers: string | null;
  /** The supplier's public page, when the venue linked one. */
  page: { handle: string | null; id: string } | null;
  /** How many of the venue's ingredients come from them. */
  items: number;
}

export interface SupplierItem {
  item_id: string;
  name: string;
  pack: string | null;
}

export type SupplierChange = Partial<Pick<VenueSupplier, 'id' | 'website' | 'order_notes' | 'order_by' | 'delivers'>> &
  Pick<VenueSupplier, 'name' | 'supplies'> & {
    /** Link (or keep) the supplier's public page; left out, the link stays as it is. */
    profile_id?: string | null;
  };

const suppliersKey = (barId: string | null | undefined) => ['venue-suppliers', barId] as const;

/** The venue's suppliers, A to Z, with how many ingredients each brings. Empty for anyone without Prep or Costs. */
export function useVenueSuppliers(barId: string | null | undefined) {
  return useQuery({
    queryKey: suppliersKey(barId),
    enabled: !!barId,
    queryFn: async (): Promise<VenueSupplier[]> => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, website, order_notes, supplies, order_by, delivers, page:profiles(id, handle), item_purchasing(count)')
        .eq('bar_id', barId!)
        .order('name');
      if (error) throw error;
      type Row = Omit<VenueSupplier, 'items'> & { item_purchasing: { count: number }[] | null };
      return ((data ?? []) as unknown as Row[]).map(({ item_purchasing, ...row }) => ({ ...row, items: item_purchasing?.[0]?.count ?? 0 }));
    },
  });
}

/** What the venue buys from one supplier, A to Z, with its pack size. */
export function useSupplierItems(barId: string, supplierId: string | null) {
  return useQuery({
    queryKey: ['supplier-items', barId, supplierId],
    enabled: !!supplierId,
    queryFn: async (): Promise<SupplierItem[]> => {
      const { data, error } = await supabase
        .from('item_purchasing')
        .select('item_id, pack_size_amount, pack_size_unit, item:items(name)')
        .eq('bar_id', barId)
        .eq('supplier_id', supplierId!);
      if (error) throw error;
      type Row = { item_id: string; pack_size_amount: number | null; pack_size_unit: string | null; item: { name: string } | null };
      return ((data ?? []) as unknown as Row[])
        .map((r) => ({ item_id: r.item_id, name: r.item?.name ?? 'An ingredient', pack: r.pack_size_amount ? `${r.pack_size_amount} ${r.pack_size_unit ?? ''}`.trim() : null }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

function useInvalidate(barId: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: suppliersKey(barId) });
    // The ingredient price section, Prep's order list and the kit name suppliers too.
    void client.invalidateQueries({ queryKey: ['item-purchase', barId] });
    void client.invalidateQueries({ queryKey: ['prep-data'] });
    void client.invalidateQueries({ queryKey: ['bar-kit', barId] });
  };
}

/** Add a supplier, or change one (by id). */
export function useSaveSupplier(barId: string) {
  const invalidate = useInvalidate(barId);
  return useMutation({
    mutationFn: async ({ id, ...change }: SupplierChange) => {
      const row = {
        name: change.name.trim(),
        supplies: change.supplies,
        website: change.website?.trim() || null,
        order_notes: change.order_notes?.trim() || null,
        order_by: change.order_by?.trim() || null,
        delivers: change.delivers?.trim() || null,
        ...(change.profile_id !== undefined ? { profile_id: change.profile_id } : {}),
      };
      const { error } = id ? await supabase.from('suppliers').update(row).eq('id', id) : await supabase.from('suppliers').insert({ bar_id: barId, ...row });
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

/** Remove a supplier. Its ingredients and kit stay, with no supplier. */
export function useRemoveSupplier(barId: string) {
  const invalidate = useInvalidate(barId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
    },
    onSettled: invalidate,
  });
}

/** A supplier page that could supply the venue, as the suggestions list shows it. */
export interface SupplierPage {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  supplies: string[];
}

export interface SuggestionData {
  /** "AU-VIC" and "AU": where the venue is, as supplier lines name it. */
  regions: string[];
  /** The venue's bottles with a maker: its drinks' and preps' ingredients, and what it buys. */
  bottles: { itemId: string; makerId: string }[];
  lines: { makerId: string; region: string; page: SupplierPage }[];
}

const chunks = <T,>(xs: readonly T[], n = 100) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/**
 * What the Suppliers page suggests from: the venue's region, its bottles and
 * their makers, and the supplier lines that carry those makers there.
 * ponytail: five reads from the app, fine for a settings page; an RPC if a
 * venue's drinks outgrow one 1,000-row read.
 */
export function useSupplierSuggestionData(barId: string | null) {
  return useQuery({
    queryKey: ['supplier-suggestions', barId],
    enabled: !!barId,
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<SuggestionData> => {
      const [pageRes, drinksRes, boughtRes] = await Promise.all([
        supabase.from('profiles').select('country_code, region').eq('bar_id', barId!).eq('kind', 'bar').maybeSingle(),
        supabase.from('items').select('recipes:app_recipe_presentation!recipe_item_id(ingredient_item_id)').eq('bar_id', barId!).limit(1000),
        supabase.from('item_purchasing').select('item_id').eq('bar_id', barId!).limit(1000),
      ]);
      if (pageRes.error) throw pageRes.error;
      if (drinksRes.error) throw drinksRes.error;
      if (boughtRes.error) throw boughtRes.error;
      const regions = venueRegions(pageRes.data?.country_code, pageRes.data?.region);
      type Drink = { recipes: { ingredient_item_id: string | null }[] | null };
      const ids = new Set<string>((boughtRes.data ?? []).map((r: { item_id: string }) => r.item_id));
      for (const d of (drinksRes.data ?? []) as unknown as Drink[]) for (const r of d.recipes ?? []) if (r.ingredient_item_id) ids.add(r.ingredient_item_id);
      if (!regions.length || !ids.size) return { regions, bottles: [], lines: [] };

      const bottles: SuggestionData['bottles'] = [];
      for (const part of chunks([...ids])) {
        const { data, error } = await supabase.from('items').select('id, maker_profile_id').in('id', part).not('maker_profile_id', 'is', null);
        if (error) throw error;
        for (const r of (data ?? []) as { id: string; maker_profile_id: string }[]) bottles.push({ itemId: r.id, makerId: r.maker_profile_id });
      }
      const lines: SuggestionData['lines'] = [];
      for (const part of chunks([...new Set(bottles.map((b) => b.makerId))])) {
        const { data, error } = await supabase
          .from('supplier_lines')
          .select('maker_profile_id, region, page:profiles!supplier_lines_supplier_profile_id_fkey(id, handle, display_name, avatar_url, supplies)')
          .in('maker_profile_id', part)
          .in('region', regions)
          .limit(1000);
        if (error) throw error;
        type Line = { maker_profile_id: string; region: string; page: SupplierPage | null };
        for (const l of (data ?? []) as unknown as Line[]) if (l.page) lines.push({ makerId: l.maker_profile_id, region: l.region, page: l.page });
      }
      return { regions, bottles, lines };
    },
  });
}
