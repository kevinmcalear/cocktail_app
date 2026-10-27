import type { NotesLevel } from '@/lib/notesReaders';
import { supabase } from '@/lib/supabase';

/**
 * Readers get a drink's notes through app_item_presentation.notes, which the
 * database fills only for those allowed (20261123300000_notes_by_role).
 *
 * Write a drink's notes: new, changed, or (empty) taken away. Leaving `level`
 * out keeps whoever reads them now. Only the drink's editors can write, and
 * never over notes they can't read; a role level is for venue drinks only.
 */
export async function saveItemNotes(itemId: string, text: string, level?: NotesLevel): Promise<void> {
  const body = text.trim();
  if (!body) {
    const { error } = await supabase.from('item_notes').delete().eq('item_id', itemId);
    if (error) throw error;
    return;
  }
  const change = { body, ...(level !== undefined ? { read_level: level } : {}) };
  // Only the text and level can change (the table grants no more), so not an upsert.
  const { data, error } = await supabase.from('item_notes').update(change).eq('item_id', itemId).select('item_id');
  if (error) throw error;
  if (!data?.length) {
    // None yet, or one you can't read: then the insert fails rather than overwrite it.
    const { error: added } = await supabase.from('item_notes').insert({ item_id: itemId, ...change });
    if (added?.code === '23505') throw new Error('This drink already has notes for a role above yours, so yours can’t replace them. Ask an Admin.');
    if (added) throw added;
  }
}
