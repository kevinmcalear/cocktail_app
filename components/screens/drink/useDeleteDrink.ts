import { useQueryClient, type QueryKey } from '@tanstack/react-query';

import { useToast } from '@/components/ds';
import { useDeleteCocktail } from '@/hooks/useCocktails';
import { useToastStore } from '@/store/useToastStore';

/** The lists a deleted drink leaves at once: Library's drinks and a menu builder's library. */
const LISTS: QueryKey[] = [['cocktails'], ['menu-library']];

/**
 * Delete drink with Undo (drink page More, a menu row, the editor). Deleting
 * an item is for good (its spec, photos and menu places go with it), so
 * nothing is sent while the toast shows: the drink leaves the lists at once,
 * Undo puts it back, and the delete goes when the toast does (timed out,
 * swiped, tapped or replaced). If the app closes first nothing was sent, so
 * the drink is still there; the hidden lists are marked stale so they read it
 * again on the next launch. `onGone` runs when the toast goes, either way.
 */
export function useDeleteDrink() {
  const qc = useQueryClient();
  const toast = useToast();
  const remove = useDeleteCocktail();
  return ({ id, name, onUndo, onGone }: { id: string; name: string; onUndo?: () => void; onGone?: () => void }) => {
    const before = LISTS.flatMap((queryKey) => {
      void qc.cancelQueries({ queryKey });
      const snapshots = qc.getQueriesData<{ id: string }[]>({ queryKey });
      qc.setQueriesData<{ id: string }[]>({ queryKey }, (rows) => (Array.isArray(rows) ? rows.filter((r) => r.id !== id) : rows), { updatedAt: 0 });
      return snapshots;
    });
    let undone = false;
    const shown = toast.show({
      title: `${name} deleted`,
      detail: 'Its spec and photos go too, for everyone.',
      action: {
        label: 'Undo',
        onPress: () => {
          undone = true;
          for (const [key, rows] of before) qc.setQueryData(key, rows);
          onUndo?.();
        },
      },
    });
    // The mutation's own options run after this screen has gone, so the delete still goes.
    const stop = useToastStore.subscribe((s) => {
      if (s.toast?.id === shown) return;
      stop();
      if (!undone) remove.mutate(id);
      onGone?.();
    });
  };
}
