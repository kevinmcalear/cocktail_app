import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useItemFlavors } from '@/hooks/useFlavor';
import { useItemSketches } from '@/hooks/useItemSketch';
import type { Profile } from '@/lib/flavor';
import { liquidOf } from '@/lib/sketch/types';
import { supabase } from '@/lib/supabase';
import { saveSwipes } from '@/lib/swipes';

export interface DeckDrink {
  id: string;
  name: string;
  /** "Gin, Chartreuse, maraschino, lime": its spec's ingredients, in order. */
  ingredients: string;
  profile: Profile | null;
  /** Its paint colour, for its card. */
  tint: string | null;
}

/**
 * Drinks to swipe Want or Not for me on (board Loop-want): want_deck's
 * classics you haven't wanted, passed on or had, each with a flavour profile
 * so its card can show a match, less any in `skip`, up to `count`.
 */
export function useWantDeck(count: number, skip: readonly string[], enabled = true) {
  const deck = useQuery({
    queryKey: ['want-deck', count + skip.length],
    enabled,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<{ id: string; name: string; ingredients: string }[]> => {
      const { data, error } = await supabase.rpc('want_deck', { p_limit: count + skip.length });
      if (error) throw error;
      const ids = (data ?? []).map((d) => d.item_id);
      if (!ids.length) return [];
      // The spec as everyone sees it (app_recipe_presentation), less its garnish.
      const lines = await supabase.from('app_recipe_presentation').select('recipe_item_id, is_garnish, display_ingredient(name)').in('recipe_item_id', ids).order('sort_order');
      if (lines.error) throw lines.error;
      const byId = new Map<string, string[]>();
      for (const l of lines.data ?? []) {
        if (!l.recipe_item_id || l.is_garnish || !l.display_ingredient?.name) continue;
        byId.set(l.recipe_item_id, [...(byId.get(l.recipe_item_id) ?? []), l.display_ingredient.name]);
      }
      return (data ?? []).map((d) => {
        const names = byId.get(d.item_id) ?? [];
        const line = names.join(', ');
        return { id: d.item_id, name: d.name, ingredients: line ? line.charAt(0).toUpperCase() + line.slice(1) : '' };
      });
    },
  });
  const rows = useMemo(() => (deck.data ?? []).filter((d) => !skip.includes(d.id)).slice(0, count), [deck.data, skip, count]);
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const flavors = useItemFlavors(ids);
  const sketches = useItemSketches(ids);
  const drinks = useMemo(
    (): DeckDrink[] =>
      rows.map((r) => {
        const inputs = sketches.byId[r.id];
        return { ...r, profile: flavors.data?.[r.id] ?? null, tint: inputs ? liquidOf(inputs).hex : null };
      }),
    [rows, flavors.data, sketches.byId]
  );
  // With no rows the flavours never load (nothing to ask for): the deck is ready, and empty.
  return { drinks, ready: !deck.isPending && (!rows.length || !flavors.isPending), error: deck.error, refetch: deck.refetch };
}

/**
 * The swipes' answers: a Not for me is a drink_passes row, so the deck never
 * shows that drink again; a Want a want_list row (source 'swipe'), which,
 * like all collecting, the database takes only from a confirmed age
 * (SwipesStep asks first). Passes save first and apart, so a refused Want
 * never takes them with it. Answering the same drink twice keeps the first.
 */
export function useSaveSwipes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveSwipes,
    onSettled: () => void qc.invalidateQueries({ queryKey: ['collection'] }),
    onError: () => {},
  });
}
