import { supabase } from '@/lib/supabase';
import type { StepNote } from '@/lib/stepNotes';
import type { Insert } from '@/types/db';

// The words on a drink's steps (drink_step_notes, 20261205800000). The drink
// page reads them with the drink (DRINK_PAGE_COLUMNS, step_notes); the editor
// reads the table itself and writes it here.

/** A drink's step words as stored, for the editor. */
export async function fetchStepNotes(itemId: string): Promise<StepNote[]> {
  const { data, error } = await supabase.from('drink_step_notes').select('step_key, aside, note').eq('item_id', itemId);
  if (error) throw error;
  return data ?? [];
}

/** Saves a drink's step words: these rows, then clears the steps in `gone`. A retry sends the same. */
export async function saveStepNotes(itemId: string, rows: readonly StepNote[], gone: readonly string[]) {
  const upserts: Insert<'drink_step_notes'>[] = rows.map((r) => ({ item_id: itemId, step_key: r.step_key, aside: r.aside, note: r.note }));
  if (upserts.length) {
    const { error } = await supabase.from('drink_step_notes').upsert(upserts, { onConflict: 'item_id,step_key' });
    if (error) throw error;
  }
  if (gone.length) {
    const { error } = await supabase.from('drink_step_notes').delete().eq('item_id', itemId).in('step_key', [...gone]);
    if (error) throw error;
  }
}
