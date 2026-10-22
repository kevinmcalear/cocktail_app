import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { cocktailQuery } from '@/hooks/useCocktails';
import { useCreateDrink } from '@/hooks/useCreateDrink';
import { useDrinkLists, type DrinkList } from '@/hooks/useDiscover';
import { useViewAs } from '@/hooks/useViewAs';
import { draftFromSpec, EMPTY_DRAFT, newDraftId, type SourceSpec } from '@/lib/drinkWizard';
import { supabase } from '@/lib/supabase';
import { haveClassics, topClassics } from '@/lib/whatNext';

/**
 * How many people rank each classic (get_item_scores over the catalog, 200 at
 * a time). ponytail: it counts rankings of the classic itself, and only once
 * a drink has the 20 rankers a score needs; a bar's own Negroni ranked as a
 * Negroni isn't in it. A `top_ranked_classics` RPC over the ranking refresh
 * (counted_rank_scores by ranked_as_item_id) is the upgrade; it needs a migration.
 */
function useClassicRankers(ids: readonly string[]) {
  return useQuery({
    queryKey: ['classic-rankers', ids.length],
    enabled: ids.length > 0,
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<Record<string, number>> => {
      const out: Record<string, number> = {};
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await supabase.rpc('get_item_scores', { p_item_ids: ids.slice(i, i + 200) });
        if (error) throw error;
        for (const r of (data ?? []) as { item_id: string; rankers: number }[]) out[r.item_id] = r.rankers;
      }
      return out;
    },
  });
}

/** The 20 most ranked classics in the app, best-known first among equals. */
export function useTopClassics() {
  const catalog = useDrinkLists();
  const ids = useMemo(() => (catalog.data ?? []).map((c) => c.id), [catalog.data]);
  const rankers = useClassicRankers(ids);
  // Rankings that fail to load still leave the best-known 20.
  const classics = useMemo(() => topClassics(catalog.data ?? [], rankers.data ?? {}), [catalog.data, rankers.data]);
  return { classics, isLoading: catalog.isLoading || (rankers.isLoading && ids.length > 0), error: catalog.error };
}

/** Which of these classics the venue already has: a version of it, or a drink of the same name. */
export function useBarClassics(barId: string | null | undefined, classics: readonly DrinkList[]) {
  const ids = classics.map((c) => c.id);
  return useQuery({
    queryKey: ['bar-classics', barId, ids],
    enabled: !!barId && ids.length > 0,
    queryFn: async (): Promise<string[]> => {
      const base = () => supabase.from('items').select('name, riff_of_id').eq('bar_id', barId!).eq('item_type', 'cocktail');
      const [riffs, named] = await Promise.all([base().in('riff_of_id', ids), base().in('name', classics.map((c) => c.name))]);
      if (riffs.error) throw riffs.error;
      if (named.error) throw named.error;
      return [...haveClassics(classics, [...(riffs.data ?? []), ...(named.data ?? [])])];
    },
  });
}

/**
 * Adds classics to the venue's Library as its own copies: each one's spec
 * (amounts in its own units), glass, ice and methods, a version of the
 * classic, credited to nobody at the venue. One at a time, so `done` counts
 * up and a failure keeps the ones already in.
 */
export function useAddClassics(barId: string | null | undefined) {
  const client = useQueryClient();
  const { viewAsRoleLevel } = useViewAs();
  const create = useCreateDrink();
  const [done, setDone] = useState(0);
  const mutation = useMutation({
    mutationFn: async (classics: readonly DrinkList[]) => {
      setDone(0);
      for (const c of classics) {
        const spec = await client.fetchQuery({ ...cocktailQuery(c.id, viewAsRoleLevel), staleTime: 60_000 });
        if (!spec) throw new Error(`Couldn’t load the ${c.name}.`);
        const draft = { ...EMPTY_DRAFT, ...draftFromSpec(spec as unknown as SourceSpec, ''), id: newDraftId(), name: c.name, creator: 'nobody' as const, elsewhere: true, place: null };
        await create.mutateAsync({ draft, barId: barId!, myProfileId: null });
        setDone((n) => n + 1);
      }
    },
    onSettled: () => client.invalidateQueries({ queryKey: ['bar-classics', barId] }),
  });
  return { ...mutation, done };
}
