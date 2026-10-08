// Since 20261007235000 a bar-credited drink's notes live in
// credited_drink_notes, and a trigger keeps them off items. The older seed
// migrations read items.notes (a "Spec adapted from ..." note means the spec
// was left out on purpose), so a test that re-runs one calls this first,
// inside its rolled-back transaction, to give the seed the rows it was
// written against.
export async function notesBackOnRows(db) {
  await db.query('ALTER TABLE public.items DISABLE TRIGGER keep_credited_drink_notes');
  await db.query('ALTER TABLE public.items DISABLE TRIGGER move_new_credited_drink_notes');
  await db.query('UPDATE public.items i SET notes = n.notes FROM public.credited_drink_notes n WHERE n.item_id = i.id');
}
