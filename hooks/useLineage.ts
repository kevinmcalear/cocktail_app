import { useQuery } from '@tanstack/react-query';

import { parentId, sortRiffs, styleChain, walkAncestors, type DrinkStyle, type LineageDrink } from '@/lib/lineage';
import { supabase } from '@/lib/supabase';

// The credit columns aren't in app_item_presentation, so these read items
// directly; the items RLS policy applies the same visibility rules.
export const PROFILE_COLUMNS = 'id, kind, handle, display_name, avatar_url, locality, is_closed, closed_year';
export const LINEAGE_COLUMNS = `id, name, riff_of_id, origin_year, origin_year_approx, credit_status, origin,
  is_catalog, lineage_parent_id, lineage_style_id, lineage_note,
  creator:profiles!items_creator_profile_id_fkey(${PROFILE_COLUMNS}),
  origin_bar:profiles!items_origin_bar_profile_id_fkey(${PROFILE_COLUMNS}),
  co_creators:item_co_creators(profile:profiles(${PROFILE_COLUMNS}))`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const STYLE_COLUMNS = 'id, key, name, family, parent_style_id, year, year_approx, summary';

async function fetchDrink(id: string): Promise<LineageDrink | null> {
  const { data, error } = await supabase.from('items').select(LINEAGE_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as unknown as LineageDrink | null) ?? null;
}

/** Every historic style (about 25 rows), for family trees. */
export async function fetchStyles(): Promise<DrinkStyle[]> {
  const { data, error } = await supabase.from('drink_styles').select(STYLE_COLUMNS);
  if (error) throw error;
  return (data ?? []) as unknown as DrinkStyle[];
}

export interface Lineage {
  drink: LineageDrink | null;
  /** Root first; the last one is what this drink is a riff of. */
  ancestors: LineageDrink[];
  /** The historic styles above the oldest drink, oldest first (Punch, Sour). */
  styles: DrinkStyle[];
  /** Classics that came from this one (Penicillin under Gold Rush). */
  classics: LineageDrink[];
  /** Bars' versions and riffs on it, best-credited first. */
  riffs: LineageDrink[];
}

/**
 * A drink's family: its credit, what it's a riff of up to the first classic,
 * the styles above that, and what came from it. Drinks the reader can't see
 * are left out.
 * ponytail: one query per ancestor (lines are up to about 8 deep); a recursive
 * RPC is the upgrade if that gets slow.
 */
export function useLineage(itemId: string | null | undefined) {
  return useQuery({
    queryKey: ['lineage', itemId],
    // Only a real uuid reaches the queries (dev ids like "dev" would 400).
    enabled: !!itemId && UUID.test(itemId),
    queryFn: async (): Promise<Lineage> => {
      // Two queries so a classic's bar versions (the Negroni has hundreds)
      // never crowd its child classics out of the row limit.
      // ponytail: the 100 best-credited versions; page them if a list needs more.
      const [drink, kids, versions] = await Promise.all([
        fetchDrink(itemId!),
        supabase.from('items').select(LINEAGE_COLUMNS).eq('lineage_parent_id', itemId!).limit(500),
        supabase
          .from('items')
          .select(LINEAGE_COLUMNS)
          .eq('riff_of_id', itemId!)
          .order('credit_status', { ascending: false, nullsFirst: false })
          .order('name')
          .limit(100),
      ]);
      if (kids.error) throw kids.error;
      if (versions.error) throw versions.error;
      const ancestors = drink ? await walkAncestors(drink, fetchDrink) : [];
      const oldest = ancestors[0] ?? drink;
      const styles = oldest && !parentId(oldest) && oldest.lineage_style_id ? styleChain(oldest.lineage_style_id, await fetchStyles()) : [];
      return {
        drink,
        ancestors,
        styles,
        classics: ((kids.data ?? []) as unknown as LineageDrink[]).sort((a, b) => (a.origin_year ?? 9999) - (b.origin_year ?? 9999)),
        riffs: sortRiffs((versions.data ?? []) as unknown as LineageDrink[]),
      };
    },
  });
}
