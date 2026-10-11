import { useQuery } from '@tanstack/react-query';

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

/**
 * A drink's spec against your shelf (My Bar's own cached match), and the
 * bottle on your shelf closest to the first thing you're missing: the same
 * kind. Mount it signed in only: My Bar's match needs a shelf.
 */
export function useShelfCheck(itemId: string, lines: SpecLine[]) {
  const bar = useMyBar();
  const group = bar.oneAway.find((g) => g.drinks.some((d) => d.id === itemId)) ?? bar.twoAway.find((g) => g.drinks.some((d) => d.id === itemId));
  const verdict: ShelfVerdict = bar.canMakeIds.has(itemId) ? { ready: true } : group ? { ready: false, buy: group.bottles.map((b) => ({ id: b.id, name: b.name })) } : null;
  const check = bar.isLoading ? null : checkShelf(lines, verdict);
  const first = verdict && !verdict.ready ? verdict.buy[0] : null;
  const { data: kind } = useKindOf(first?.id ?? null);
  const closest = first && kind ? bar.shelf.find((b) => b.kind?.toLowerCase() === kind.toLowerCase() && b.id !== first.id) : undefined;
  return { check, missingName: first?.name ?? null, closest: closest?.name ?? null };
}
