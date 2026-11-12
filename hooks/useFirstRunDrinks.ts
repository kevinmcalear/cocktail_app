import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useItemFlavors } from '@/hooks/useFlavor';
import { useItemSketches } from '@/hooks/useItemSketch';
import { FIRST_RUN_DRINKS, FIRST_RUN_LABELS, type PickedDrink } from '@/lib/firstRun';
import { liquidOf } from '@/lib/sketch/types';
import { supabase } from '@/lib/supabase';

export interface FirstRunDrink extends PickedDrink {
  name: string;
  /** What the tiles and cards say (lib/firstRun FIRST_RUN_LABELS). */
  label: string;
  /** Its paint colour, for its tile and the sky. */
  tint: string | null;
}

/**
 * The nine classics first run asks about (lib/firstRun FIRST_RUN_DRINKS), from
 * the catalog, in that order, with each one's method and paint colour (its
 * drawing inputs) and flavour profile (item_flavors). A name the catalog
 * doesn't have is left out.
 */
export function useFirstRunDrinks() {
  const catalog = useQuery({
    queryKey: ['first-run-drinks'],
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const { data, error } = await supabase.from('items').select('id, name').eq('is_catalog', true).in('name', [...FIRST_RUN_DRINKS]);
      if (error) throw error;
      const byName = new Map((data ?? []).map((r) => [r.name, r]));
      return FIRST_RUN_DRINKS.flatMap((n) => (byName.has(n) ? [byName.get(n)!] : []));
    },
  });
  const ids = useMemo(() => (catalog.data ?? []).map((d) => d.id), [catalog.data]);
  const sketches = useItemSketches(ids);
  const flavors = useItemFlavors(ids);
  const drinks = useMemo(
    (): FirstRunDrink[] =>
      (catalog.data ?? []).map((d) => {
        const inputs = sketches.byId[d.id];
        const label = FIRST_RUN_LABELS[d.name as (typeof FIRST_RUN_DRINKS)[number]] ?? d.name;
        return { ...d, label, method: inputs?.method ?? null, tint: inputs ? liquidOf(inputs).hex : null, profile: flavors.data?.[d.id] ?? null };
      }),
    [catalog.data, sketches.byId, flavors.data]
  );
  // Ready once each drink's method and flavours are in: the pairs and the taste are worked out from them.
  const ready = !catalog.isPending && sketches.ready && !flavors.isPending;
  return { drinks, ready, isLoading: catalog.isPending, error: catalog.error, refetch: catalog.refetch };
}
