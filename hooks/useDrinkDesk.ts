import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { likeExactly, type NewBottle } from '@/lib/drinkWizard';
import { parseMoney } from '@/lib/money';
import type { MenuDrinkSpec } from '@/lib/menuNote';
import { supabase } from '@/lib/supabase';

/** How a bar buys one ingredient, for the cost of a drink not saved yet. */
export interface DraftPack {
  itemId: string;
  supplierId: string | null;
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
        supabase.from('item_purchasing').select('item_id, supplier_id, pack_size_amount, pack_size_unit, suppliers(name)').eq('bar_id', barId!).in('item_id', ids),
        supabase.from('item_costs').select('item_id, pack_cost_minor').eq('bar_id', barId!).in('item_id', ids),
      ]);
      if (packs.error) throw packs.error;
      if (costs.error) throw costs.error;
      const cost = new Map((costs.data ?? []).map((c) => [c.item_id as string, c.pack_cost_minor as number]));
      return (packs.data ?? []).map((p) => {
        const supplier = p.suppliers as { name: string } | { name: string }[] | null;
        return {
          itemId: p.item_id as string,
          supplierId: p.supplier_id as string | null,
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

/** Who makes each of these ingredients (items.maker_profile_id): the pick under a line suggests a supplier that carries them. */
export function useLineMakers(itemIds: readonly string[], enabled = true) {
  const ids = [...new Set(itemIds)].sort();
  return useQuery({
    queryKey: ['line-makers', ids],
    enabled: ids.length > 0 && enabled,
    staleTime: 30 * 60_000,
    queryFn: async (): Promise<Record<string, string | null>> => {
      const { data, error } = await supabase.from('items').select('id, maker_profile_id').in('id', ids);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((i) => [i.id, i.maker_profile_id]));
    },
  });
}

/**
 * Who brings one ingredient to a venue: an existing supplier, or a new one by
 * name. One supplier per ingredient per venue (item_purchasing); its pack and
 * price stay as they are. Needs Prep or Costs (RLS).
 */
export function useSetLineSupplier(barId: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, supplier }: { itemId: string; supplier: { id: string } | { name: string } }) => {
      let supplierId = 'id' in supplier ? supplier.id : null;
      if (!supplierId && 'name' in supplier) {
        const { data, error } = await supabase.from('suppliers').insert({ bar_id: barId!, name: supplier.name.trim() }).select('id').single();
        if (error) throw error;
        supplierId = data.id;
      }
      const { error } = await supabase.from('item_purchasing').upsert({ bar_id: barId!, item_id: itemId, supplier_id: supplierId }, { onConflict: 'bar_id,item_id' });
      if (error) throw error;
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['draft-packs', barId] });
      void client.invalidateQueries({ queryKey: ['venue-suppliers', barId] });
      void client.invalidateQueries({ queryKey: ['venue-ingredients', barId] });
      void client.invalidateQueries({ queryKey: ['item-purchase', barId] });
      void client.invalidateQueries({ queryKey: ['prep-data'] });
    },
  });
}

/**
 * After a drink saves: what each new bottle from the desktop page's card is
 * (only on a row this save made) and how the venue buys it (its supplier,
 * pack and pack price, set once for the venue). Not the drink's to fail: what
 * doesn't save comes back as a warning.
 */
export async function saveNewBottles(barId: string, bottles: readonly { itemId: string; name: string; bottle: NewBottle; isNew: boolean }[]): Promise<string[]> {
  const warnings: string[] = [];
  if (!bottles.length) return warnings;
  const bar = await supabase.from('bars').select('currency').eq('id', barId).maybeSingle();
  const currency = bar.data?.currency ?? null;
  for (const { itemId, name, bottle: b, isNew } of bottles) {
    try {
      const abv = b.abv.trim() ? Number(b.abv.replace(',', '.')) : null;
      if (isNew) {
        const kind = await supabase
          .from('items')
          .update({ ingredient_role: 'product', ...(b.kindId ? { generic_id: b.kindId } : {}), ...(abv != null && abv >= 0 && abv <= 100 ? { abv } : {}) })
          .eq('id', itemId);
        if (kind.error) throw kind.error;
      }
      let supplierId = b.supplier?.id ?? null;
      if (!supplierId && b.supplier?.name.trim()) {
        const same = await supabase.from('suppliers').select('id').eq('bar_id', barId).ilike('name', likeExactly(b.supplier.name.trim())).limit(1).maybeSingle();
        supplierId = same.data?.id ?? null;
        if (!supplierId) {
          const made = await supabase.from('suppliers').insert({ bar_id: barId, name: b.supplier.name.trim() }).select('id').single();
          if (made.error) throw made.error;
          supplierId = made.data.id;
        }
      }
      const pack = Number(b.packAmount.replace(',', '.'));
      if (supplierId || pack > 0) {
        const row = { bar_id: barId, item_id: itemId, ...(supplierId ? { supplier_id: supplierId } : {}), ...(pack > 0 ? { pack_size_amount: pack, pack_size_unit: b.packUnit || 'ml' } : {}) };
        const bought = await supabase.from('item_purchasing').upsert(row, { onConflict: 'bar_id,item_id' });
        if (bought.error) throw bought.error;
      }
      const price = currency && b.packPrice.trim() ? parseMoney(b.packPrice, currency) : null;
      if (price != null) {
        const cost = await supabase.from('item_costs').upsert({ bar_id: barId, item_id: itemId, pack_cost_minor: price, updated_at: new Date().toISOString() }, { onConflict: 'bar_id,item_id' });
        if (cost.error) throw cost.error;
      }
    } catch {
      warnings.push(`${name}’s supplier, pack or price didn’t save. Add them on its page.`);
    }
  }
  return warnings;
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
