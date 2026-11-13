import type { AgeCheck } from '@/lib/safety';
import { supabase } from '@/lib/supabase';
import { usePendingWants } from '@/store/usePendingWants';

/**
 * Saves swipe answers: passes to drink_passes, Wants to want_list (source
 * 'swipe'). Wants need a confirmed age (want_list's rule), so callers send
 * them only once it is. Already saved is fine.
 */
export async function saveSwipes({ wants, passes }: { wants: readonly string[]; passes: readonly string[] }): Promise<void> {
  if (passes.length) {
    const { error } = await supabase.from('drink_passes').upsert(
      passes.map((id) => ({ item_id: id })),
      { onConflict: 'user_id,item_id', ignoreDuplicates: true }
    );
    if (error) throw error;
  }
  if (wants.length) {
    const { error } = await supabase.from('want_list').insert(wants.map((id) => ({ kind: 'drink', item_id: id, source: 'swipe' })));
    if (error && error.code !== '23505') throw error;
  }
}

/**
 * First run's Wants held for the age check (store/usePendingWants), settled
 * by its answer: saved once it's confirmed, dropped when it's under age, kept
 * while it's unknown or the save fails (tried again the next time the answer
 * is read). True when it saved some.
 */
export async function settlePendingWants(age: AgeCheck): Promise<boolean> {
  const pending = usePendingWants.getState();
  if (!pending.ids.length || age === 'unknown') return false;
  if (age === 'under_age') return (pending.clear(), false);
  try {
    await saveSwipes({ wants: pending.ids, passes: [] });
    pending.clear();
    return true;
  } catch {
    return false;
  }
}
