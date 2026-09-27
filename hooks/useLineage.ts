import { useQuery } from '@tanstack/react-query';

import { sortRiffs, walkAncestors, type LineageDrink } from '@/lib/lineage';
import { supabase } from '@/lib/supabase';

// The credit columns aren't in app_item_presentation, so these read items
// directly; the items RLS policy applies the same visibility rules.
export const PROFILE_COLUMNS = 'id, kind, handle, display_name, avatar_url, locality';
export const LINEAGE_COLUMNS = `id, name, riff_of_id, origin_year, credit_status, origin,
  creator:profiles!items_creator_profile_id_fkey(${PROFILE_COLUMNS}),
  origin_bar:profiles!items_origin_bar_profile_id_fkey(${PROFILE_COLUMNS})`;

async function fetchDrink(id: string): Promise<LineageDrink | null> {
  const { data, error } = await supabase.from('items').select(LINEAGE_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as unknown as LineageDrink | null) ?? null;
}

export interface Lineage {
  drink: LineageDrink | null;
  /** Root first; the last one is what this drink is a riff of. */
  ancestors: LineageDrink[];
  /** One level down, best-credited first. */
  riffs: LineageDrink[];
}

/**
 * A drink's family: its credit, what it's a riff of up to the root, and the
 * riffs on it. Drinks the reader can't see are left out.
 * ponytail: one query per ancestor (families are 1 to 3 deep); a recursive
 * RPC is the upgrade if trees get deep.
 */
export function useLineage(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['lineage', itemId],
    enabled: !!itemId,
    queryFn: async (): Promise<Lineage> => {
      const [drink, riffs] = await Promise.all([
        fetchDrink(itemId!),
        supabase.from('items').select(LINEAGE_COLUMNS).eq('riff_of_id', itemId!).limit(50),
      ]);
      if (riffs.error) throw riffs.error;
      const ancestors = drink ? await walkAncestors(drink, fetchDrink) : [];
      return { drink, ancestors, riffs: sortRiffs((riffs.data ?? []) as unknown as LineageDrink[]) };
    },
  });
}
