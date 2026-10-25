import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useMyBar } from '@/hooks/useHomeBar';
import { checkShelf, type ShelfVerdict } from '@/lib/shelfCheck';
import type { SpecLine } from '@/lib/spec';
import { supabase } from '@/lib/supabase';

/** What a bottle is a kind of ("Amaro" for Cynar), or its own name when it's a kind already. */
function useKindOf(itemId: string | null) {
  return useQuery({
    queryKey: ['kind-of', itemId],
    enabled: !!itemId,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.from('items').select('name, generic:generic_id(name)').eq('id', itemId!).maybeSingle();
      if (error) throw error;
      const row = data as { name: string; generic: { name: string } | null } | null;
      return row?.generic?.name ?? row?.name ?? null;
    },
  });
}

/** Each item's kind (generic) id: a spec line's, so a bottle to buy that's a kind still marks its line; what Add by hand's juice is squeezed from. */
export function useKindsOf(ids: string[]) {
  const sorted = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ['kinds-of', sorted],
    enabled: sorted.length > 0,
    // The last answer stays while a new set loads, so Add by hand's rows don't flicker as you type.
    placeholderData: keepPreviousData,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Record<string, string | null>> => {
      const { data, error } = await supabase.from('items').select('id, generic_id').in('id', sorted);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.id, r.generic_id]));
    },
  });
}

/**
 * A drink's spec against your shelf (My Bar's own cached match), and the
 * bottle on your shelf closest to the first thing you're missing: the same
 * kind. Mount it signed in only: My Bar's match needs a shelf.
 */
export function useShelfCheck(itemId: string, lines: SpecLine[]) {
  const bar = useMyBar();
  const group = bar.oneAway.find((g) => g.drinks.some((d) => d.id === itemId)) ?? bar.twoAway.find((g) => g.drinks.some((d) => d.id === itemId));
  const verdict: ShelfVerdict = bar.canMakeIds.has(itemId) ? { ready: true } : group ? { ready: false, buy: group.bottles.map((b) => ({ id: b.id, name: b.name })) } : null;
  const { data: kinds } = useKindsOf(verdict && !verdict.ready ? lines.flatMap((l) => (l.ingredientId ? [l.ingredientId] : [])) : []);
  const check = bar.isLoading ? null : checkShelf(lines, verdict, kinds);
  const first = verdict && !verdict.ready ? verdict.buy[0] : null;
  // The spec line it marks: "Green Chartreuse", not the kind the server asked for ("Herbal Liqueur").
  const line = check?.missing.length ? lines.find((l) => l.key === check.missing[0]) : undefined;
  const askedForKind = !!line?.ingredientId && kinds?.[line.ingredientId] === first?.id;
  const { data: kindOfFirst } = useKindOf(first && !askedForKind ? first.id : null);
  const kind = askedForKind ? first?.name : kindOfFirst;
  const inSpec = new Set(lines.map((l) => l.ingredientId));
  const closest = first && kind ? bar.shelf.find((b) => b.kind?.toLowerCase() === kind.toLowerCase() && b.id !== first.id && !inSpec.has(b.id)) : undefined;
  // The bottles to buy, for Add to shopping.
  const buy = verdict && !verdict.ready ? verdict.buy : [];
  return { check, missingName: line?.ingredient ?? first?.name ?? null, closest: closest?.name ?? null, buy };
}
