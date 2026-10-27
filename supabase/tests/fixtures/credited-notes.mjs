// Since 20261124200000 a drink's notes live only in item_notes and items has
// no notes column (20261008050000 had already moved bar-credited drinks'
// notes to a side table). The older seed migrations write and read
// items.notes (a "Spec adapted from ..." note means the spec was left out on
// purpose), so a test that re-runs one calls this first, inside its
// rolled-back transaction, to give the seed the column and rows it was
// written against.
export async function notesBackOnRows(db) {
  await db.query('ALTER TABLE public.items ADD COLUMN notes text');
  await db.query('UPDATE public.items i SET notes = n.body FROM public.item_notes n WHERE n.item_id = i.id');
}
