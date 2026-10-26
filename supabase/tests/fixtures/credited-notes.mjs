// Since 20261008050000 a bar-credited drink's notes stay off items (a
// trigger), and since 20261123300000 every drink's notes live in item_notes,
// with items.notes kept only for installed apps until 20261123310000 drops
// it. The older seed migrations read items.notes (a "Spec adapted from ..."
// note means the spec was left out on purpose), so a test that re-runs one
// calls this first, inside its rolled-back transaction, to give the seed the
// rows it was written against.
export async function notesBackOnRows(db) {
  for (const trigger of ['keep_credited_drink_notes', 'move_new_credited_drink_notes', 'items_notes_to_item_notes', 'items_new_notes_to_item_notes']) {
    await db.query(`ALTER TABLE public.items DISABLE TRIGGER ${trigger}`);
  }
  await db.query('UPDATE public.items i SET notes = n.body FROM public.item_notes n WHERE n.item_id = i.id');
}
