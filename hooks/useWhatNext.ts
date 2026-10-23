import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { cocktailQuery } from '@/hooks/useCocktails';
import { useCreateDrink } from '@/hooks/useCreateDrink';
import { useDrinkLists, type DrinkList } from '@/hooks/useDiscover';
import { useViewAs } from '@/hooks/useViewAs';
import { draftFromSpec, EMPTY_DRAFT, newDraftId, type SourceSpec } from '@/lib/drinkWizard';
import { supabase } from '@/lib/supabase';
import { haveClassics, topClassics } from '@/lib/whatNext';

/**
 * How many people rank each classic, counting a bar's drink ranked as it
 * (top_ranked_classics). Only ranked classics come back, most ranked first;
 * topClassics fills the rest of the 20 in the catalog's best-known order,
 * which also breaks ties. 100 rows is room for ties past the 20th.
 */
function useClassicRankers() {
  return useQuery({
    queryKey: ['top-ranked-classics'],
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.rpc('top_ranked_classics', { p_limit: 100 });
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.item_id, r.rankers]));
    },
  });
}

/** The 20 most ranked classics in the app, best-known first among equals. */
export function useTopClassics() {
  const catalog = useDrinkLists();
  const rankers = useClassicRankers();
  // Rankings that fail to load still leave the best-known 20.
  const classics = useMemo(() => topClassics(catalog.data ?? [], rankers.data ?? {}), [catalog.data, rankers.data]);
  return { classics, isLoading: catalog.isLoading || rankers.isLoading, error: catalog.error };
}

/**
 * Which of these classics the venue already has: a version of it, or a drink
 * of the same name however it's spelled. ponytail: reads the venue's cocktail
 * names in one go, fine for a few hundred; an RPC that matches in SQL is the
 * upgrade.
 */
export function useBarClassics(barId: string | null | undefined, classics: readonly DrinkList[]) {
  const ids = classics.map((c) => c.id);
  return useQuery({
    queryKey: ['bar-classics', barId, ids],
    enabled: !!barId && ids.length > 0,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('items').select('name, riff_of_id').eq('bar_id', barId!).eq('item_type', 'cocktail');
      if (error) throw error;
      return [...haveClassics(classics, data ?? [])];
    },
  });
}

/**
 * Adds classics to the venue's Library as its own copies: each one's spec
 * (amounts in its own units), glass, ice and methods, a version of the
 * classic, credited to nobody at the venue. A few at a time; `done` counts
 * up, and a failure keeps the ones that went in.
 */
export function useAddClassics(barId: string | null | undefined) {
  const client = useQueryClient();
  const { viewAsRoleLevel } = useViewAs();
  const create = useCreateDrink();
  const [done, setDone] = useState(0);
  const mutation = useMutation({
    mutationFn: async (classics: readonly DrinkList[]) => {
      setDone(0);
      const queue = [...classics];
      const failed: unknown[] = [];
      // Four at a time: each is a dozen small requests, one by one is a minute or more.
      const worker = async () => {
        for (let c = queue.shift(); c; c = queue.shift()) {
          try {
            const spec = await client.fetchQuery({ ...cocktailQuery(c.id, viewAsRoleLevel), staleTime: 60_000 });
            if (!spec) throw new Error(`Couldn’t load the ${c.name}.`);
            const draft = { ...EMPTY_DRAFT, ...draftFromSpec(spec as unknown as SourceSpec, ''), id: newDraftId(), name: c.name, creator: 'nobody' as const, elsewhere: true, place: null };
            await create.mutateAsync({ draft, barId: barId!, myProfileId: null });
            setDone((n) => n + 1);
          } catch (e) {
            failed.push(e);
          }
        }
      };
      await Promise.all(Array.from({ length: 4 }, worker));
      if (failed.length) throw failed[0];
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['bar-classics', barId] }),
  });
  return { ...mutation, done };
}
