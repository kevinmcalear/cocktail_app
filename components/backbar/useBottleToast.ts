import { useToast } from '@/components/ds';
import { useBottleSpots } from '@/hooks/useBackBar';
import { useUndoSwap } from '@/hooks/useBulk';
import { plainDbMessage } from '@/lib/dbError';
import type { ItemLocation } from '@/types/backBar';

export interface BottleDone {
  title: string;
  detail?: string;
  bottle: { id: string; name: string };
  replaceWith: { id: string; name: string } | null;
  /** The versions Undo puts back, one per drink or prep swapped. */
  undone: { itemId: string; version: number }[];
  /** Spots now holding the new bottle. */
  moved: string[];
  /** Spots taken off, whole. */
  removed: Omit<ItemLocation, 'item'>[];
}

/**
 * After a Replace or Take it off on the back bar (board step 3): a toast
 * saying what changed, and Undo for all of it, the drinks and the spots.
 * Used by the back bar screen, so Undo still works once the sheet closes.
 */
export function useBottleToast(barId: string | null) {
  const toast = useToast();
  const undo = useUndoSwap();
  const spots = useBottleSpots(barId);
  return (done: BottleDone) => {
    let used = false;
    toast.show({
      title: done.title,
      detail: done.detail ?? (done.undone.length ? 'The old specs are in their history.' : undefined),
      action: {
        label: 'Undo',
        onPress: () => {
          if (used) return;
          used = true;
          void (async () => {
            try {
              if (done.undone.length) await undo.mutateAsync(done.undone);
              if (done.moved.length) await spots.pointBack.mutateAsync({ ids: done.moved, itemId: done.bottle.id });
              if (done.removed.length) await spots.putBack.mutateAsync(done.removed);
            } catch (e) {
              toast.show({ title: 'Couldn’t undo all of it', detail: plainDbMessage(e) ?? 'Check your connection. Old specs stay in each drink’s history.' });
            }
          })();
        },
      },
    });
  };
}
