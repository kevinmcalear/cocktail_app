import { supabase } from '@/lib/supabase';

/**
 * The columns whose value differs from what the form loaded. Save writes only
 * these, so a field the form couldn't load is never written back blank.
 */
export function changedColumns<T extends Record<string, unknown>>(loaded: T, next: T): Partial<T> {
  return Object.fromEntries(Object.entries(next).filter(([key, value]) => value !== loaded[key])) as Partial<T>;
}

/**
 * Saves an item's tags (item_categories) as the form changed them: unlinks
 * only the tags it loaded that are now unticked, and links the newly ticked
 * ones. A tag the form never loaded (added elsewhere since) is left alone.
 */
export async function saveItemTags(itemId: string, loaded: readonly string[], selected: readonly string[]) {
  const toDelete = loaded.filter((c) => !selected.includes(c));
  const toAdd = selected.filter((c) => !loaded.includes(c));
  if (toDelete.length) {
    const { error } = await supabase.from('item_categories').delete().eq('item_id', itemId).in('category_id', toDelete);
    if (error) throw error;
  }
  if (toAdd.length) {
    const rows = toAdd.map((category_id) => ({ item_id: itemId, category_id, is_primary: true }));
    const { error } = await supabase.from('item_categories').upsert(rows, { onConflict: 'item_id,category_id' });
    if (error) throw error;
  }
}
