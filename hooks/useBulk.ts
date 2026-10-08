import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { refreshIngredients, useDropdowns } from '@/hooks/useDropdowns';
import { saveDrinkSpec } from '@/hooks/useVersions';
import { plainDbMessage } from '@/lib/dbError';
import { orderedMethodIds } from '@/lib/drinkMethods';
import type { CatalogItem } from '@/lib/match';
import type { BringWrite, NamedItem } from '@/lib/paste';
import { swappedLines, type SwapDrink, type SwapLine, type SwapMode } from '@/lib/swapBottle';
import { readAnything } from '@/lib/readAnything';
import { capitalize } from '@/lib/stringUtils';
import { supabase } from '@/lib/supabase';

/** After a bulk write: the lists it touches, the pages of the drinks it changed, and the ingredients it added or removed. */
function useRefreshSpecs() {
  const queryClient = useQueryClient();
  return ({ drinkIds = [], ingredientIds = [] }: { drinkIds?: string[]; ingredientIds?: string[] } = {}) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['cocktails'] }),
      ...drinkIds.map((id) => queryClient.invalidateQueries({ queryKey: ['cocktail', id] })),
      queryClient.invalidateQueries({ queryKey: ['ingredients'] }),
      queryClient.invalidateQueries({ queryKey: ['ingredient'] }),
      queryClient.invalidateQueries({ queryKey: ['menu-library'] }),
      queryClient.invalidateQueries({ queryKey: ['swap-source'] }),
      queryClient.invalidateQueries({ queryKey: ['item-versions'] }),
      refreshIngredients(queryClient, ingredientIds),
    ]);
}

function toCatalog(rows: unknown): CatalogItem[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const item = row as Record<string, unknown>;
    if (typeof item.id !== 'string' || typeof item.name !== 'string') return [];
    return [{ id: item.id, name: item.name, genericId: typeof item.generic_id === 'string' ? item.generic_id : null, barId: typeof item.bar_id === 'string' ? item.bar_id : null }];
  });
}

function toNamed(rows: unknown): NamedItem[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const item = row as Record<string, unknown>;
    return typeof item.id === 'string' && typeof item.name === 'string' ? [{ id: item.id, name: item.name }] : [];
  });
}

/** Bring in's reader (read-anything): photos, PDFs or text of a menu, recipes or bottles. */
export function useReadAnything() {
  return useMutation({ mutationFn: readAnything, onError: () => {} });
}

/** Ingredients (with their other names), methods and glassware the paste, the bottle photo and the swap match against. */
export function useSpecCatalog() {
  const { data, isLoading } = useDropdowns({ ingredients: true });
  const catalog = useMemo(() => toCatalog(data?.ingredients), [data?.ingredients]);
  const methods = useMemo(() => toNamed(data?.methods), [data?.methods]);
  const glasses = useMemo(() => toNamed(data?.glassware), [data?.glassware]);
  const aliases = useMemo(() => data?.ingredientAliases ?? [], [data?.ingredientAliases]);
  return { catalog, aliases, methods, glasses, isLoading };
}

async function inChunks<T>(ids: string[], load: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 80) out.push(...(await load(ids.slice(i, i + 80))));
  return out;
}

interface SwapSource {
  drinks: SwapDrink[];
  names: Record<string, string>;
}

/** This venue's drinks and house recipes, with the spec lines a swap rewrites. */
export function useSwapSource(barId: string | null) {
  return useQuery({
    queryKey: ['swap-source', barId],
    enabled: !!barId,
    queryFn: async (): Promise<SwapSource> => {
      const items = await supabase.from('app_item_presentation').select('id, name, item_type').eq('bar_id', barId!).in('item_type', ['cocktail', 'ingredient']);
      if (items.error) throw items.error;
      const rows = items.data ?? [];
      const ids = rows.map((row) => row.id);
      if (!ids.length) return { drinks: [], names: {} };
      const lineRows = await inChunks(ids, async (chunk) => {
        const res = await supabase
          .from('app_recipe_presentation')
          .select('id, recipe_item_id, ingredient_item_id, parent_ingredient_id, amount, unit, preparation_notes, is_optional, sort_order')
          .in('recipe_item_id', chunk);
        if (res.error) throw res.error;
        return res.data ?? [];
      });
      const methodRows = await inChunks(ids, async (chunk) => {
        const res = await supabase.from('item_methods').select('item_id, method_item_id, sort_order').in('item_id', chunk);
        if (res.error) throw res.error;
        return res.data ?? [];
      });
      const names: Record<string, string> = {};
      for (const row of rows) names[row.id] = row.name;
      const missing = [...new Set(lineRows.map((line) => line.ingredient_item_id).filter((id): id is string => !!id && !names[id]))];
      if (missing.length) {
        const extra = await inChunks(missing, async (chunk) => {
          const res = await supabase.from('app_item_presentation').select('id, name').in('id', chunk);
          if (res.error) throw res.error;
          return res.data ?? [];
        });
        for (const row of extra) names[row.id] = row.name;
      }
      const byDrink = new Map<string, SwapLine[]>();
      for (const line of lineRows) {
        const list = byDrink.get(line.recipe_item_id) ?? [];
        list.push({
          id: line.id,
          ingredientId: line.ingredient_item_id,
          genericId: line.parent_ingredient_id,
          amount: line.amount,
          unit: line.unit,
          notes: line.preparation_notes,
          optional: !!line.is_optional,
        });
        byDrink.set(line.recipe_item_id, list);
      }
      const methodRowsOf = new Map<string, typeof methodRows>();
      for (const row of methodRows) methodRowsOf.set(row.item_id, [...(methodRowsOf.get(row.item_id) ?? []), row]);
      const drinks: SwapDrink[] = rows.map((row) => ({
        id: row.id,
        name: row.name,
        itemType: row.item_type === 'ingredient' ? 'ingredient' : 'cocktail',
        methodIds: orderedMethodIds(methodRowsOf.get(row.id)),
        lines: byDrink.get(row.id) ?? [],
      }));
      const lineOrder = new Map(lineRows.map((line) => [line.id, line.sort_order ?? 0]));
      for (const drink of drinks) drink.lines.sort((a, b) => (lineOrder.get(a.id) ?? 0) - (lineOrder.get(b.id) ?? 0));
      return { drinks, names };
    },
  });
}

export interface SwapResult {
  undone: { itemId: string; version: number }[];
  error: string | null;
}

/** Rewrites each drink through save_drink_spec. A failure stops the rest and keeps what finished, so it can be undone. */
export function useApplySwap() {
  const refresh = useRefreshSpecs();
  return useMutation({
    mutationFn: async (input: { drinks: SwapDrink[]; findId: string; replaceId: string; mode: SwapMode; note: string }): Promise<SwapResult> => {
      const undone: SwapResult['undone'] = [];
      try {
        for (const drink of input.drinks) {
          const version = await saveDrinkSpec(drink.id, swappedLines(drink, input.findId, input.replaceId, input.mode), drink.methodIds, input.note);
          undone.push({ itemId: drink.id, version: version - 1 });
        }
        return { undone, error: null };
      } catch (error) {
        const message = plainDbMessage(error) ?? 'Couldn’t finish the swap.';
        return { undone, error: undone.length ? `Changed ${undone.length}, then stopped. ${message}` : message };
      }
    },
    onSuccess: (result) => void refresh({ drinkIds: result.undone.map((row) => row.itemId) }),
  });
}

export function useUndoSwap() {
  const refresh = useRefreshSpecs();
  return useMutation({
    mutationFn: async (undone: { itemId: string; version: number }[]) => {
      for (const row of undone) {
        const { error } = await supabase.rpc('restore_drink_version', { p_item: row.itemId, p_version: row.version });
        if (error) throw error;
      }
    },
    onSuccess: (_data, undone) => void refresh({ drinkIds: undone.map((row) => row.itemId) }),
  });
}

/** Creates the new bottles, then the drinks, each spec saved as a version. */
export function useBringIn(barId: string | null) {
  const refresh = useRefreshSpecs();
  return useMutation({
    mutationFn: async (write: BringWrite): Promise<{ added: number; error: string | null; bottleIds: string[] }> => {
      const ids = new Map<string, string>();
      let added = 0;
      try {
        for (const create of write.creates) {
          const { data, error } = await supabase
            .from('items')
            .insert({ name: capitalize(create.name), item_type: 'ingredient', bar_id: barId, generic_id: create.genericId })
            .select('id')
            .single();
          if (error) throw error;
          ids.set(create.key, data.id);
          added += 1;
        }
        for (const item of write.items) {
          const { data, error } = await supabase
            .from('items')
            .insert({
              name: capitalize(item.name),
              item_type: item.kind,
              bar_id: barId,
              notes: item.notes,
              glassware_id: item.glassId,
            })
            .select('id')
            .single();
          if (error) throw error;
          const lines = item.lines.map((line) => {
            const ingredientId = line.ingredientKey.startsWith('new:') ? ids.get(line.ingredientKey.slice(4)) : line.ingredientKey.slice(3);
            if (!ingredientId) throw new Error(`Couldn’t find ${line.ingredientKey}.`);
            return { ingredient_item_id: ingredientId, amount: line.amount, unit: line.unit, preparation_notes: null, is_optional: false };
          });
          await saveDrinkSpec(data.id, lines, item.methodId ? [item.methodId] : [], 'Brought in');
          added += 1;
        }
        return { added, error: null, bottleIds: [...ids.values()] };
      } catch (error) {
        const message = plainDbMessage(error) ?? 'Couldn’t bring that in.';
        return { added, error: added ? `Brought in ${added}, then stopped. ${message}` : message, bottleIds: [...ids.values()] };
      }
    },
    onSuccess: (result) => void refresh({ ingredientIds: result.bottleIds }),
  });
}

export interface VenueBottle {
  name: string;
  /** The kind it is (Gin), or the shared bottle it copies. */
  genericId: string | null;
  brand: string | null;
  abv: number | null;
}

/**
 * Puts a photographed bottle in the venue's own ingredients, or takes back
 * one it just put there. Resolves the new item's id.
 */
export function useVenueBottle(barId: string | null) {
  const refresh = useRefreshSpecs();
  const add = useMutation({
    mutationFn: async (bottle: VenueBottle): Promise<string> => {
      if (!barId) throw new Error('Pick a venue first.');
      const { data, error } = await supabase
        .from('items')
        .insert({ name: bottle.name, item_type: 'ingredient', bar_id: barId, generic_id: bottle.genericId, brand_maker: bottle.brand, abv: bottle.abv })
        .select('id')
        .single();
      if (error) throw new Error(plainDbMessage(error) ?? 'Couldn’t add that bottle.');
      return data.id;
    },
    onSuccess: (id) => void refresh({ ingredientIds: [id] }),
    onError: () => {},
  });
  const remove = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('items').delete().eq('id', itemId).eq('bar_id', barId!);
      if (error) throw new Error(plainDbMessage(error) ?? 'Couldn’t take that bottle back out.');
    },
    onSuccess: (_data, itemId) => void refresh({ ingredientIds: [itemId] }),
    onError: () => {},
  });
  return { add, remove };
}

/** Sets a price only where the drink doesn't have one yet. */
export function useSetMissingPrices() {
  const refresh = useRefreshSpecs();
  return useMutation({
    mutationFn: async (updates: { id: string; price: string }[]) => {
      for (const update of updates) {
        const { error } = await supabase.from('items').update({ price: update.price }).eq('id', update.id).is('price', null);
        if (error) throw error;
      }
    },
    onSuccess: (_data, updates) => void refresh({ drinkIds: updates.map((update) => update.id) }),
  });
}
