import type { DrinkRun } from '@/lib/rankIt';
import { supabase } from '@/lib/supabase';

// Its own file: the Rank it row and sheet are separate chunks, and the sheet shouldn't carry the row's hooks to get this.

/** The menus these drinks are on (drink_list_dates), as plain rows. */
export async function drinkRuns(ids: string[]): Promise<DrinkRun[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.rpc('drink_list_dates', { p_item_ids: ids });
  if (error) throw error;
  return (data ?? []).map((r) => ({ item_id: r.item_id, profile_id: r.profile_id, edition_name: r.edition_name, is_current: r.is_current }));
}
