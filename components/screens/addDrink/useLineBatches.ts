import { useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useDragMergeDwell } from '@/hooks/useDragMergeDwell';
import { cannotBatch, dropInto, isBatch, splitBatch, withBottle } from '@/lib/batchLines';
import type { WizardDraft, WizardLine } from '@/lib/drinkWizard';
import { overIndex } from '@/lib/dropIndex';

/** Under the lines: how to move them, and on a drink how to batch them (board eddie-oct22-wave2). */
const HINT = {
  order: Platform.OS === 'web' ? 'Drag a grip to reorder.' : 'Hold a grip to reorder.',
  batch: Platform.OS === 'web' ? 'Drag a line onto another and hold to batch them. Drag a grip to reorder.' : 'Hold a line over another to batch them. Hold a grip and move it to reorder.',
};

interface Options {
  draft: WizardDraft;
  set: (patch: Partial<WizardDraft>) => void;
  /** Off for a house recipe's own lines: a syrup's sugar and water aren't batched. */
  enabled: boolean;
  /** Each line's height, in order, for where a drag is. */
  heights: () => number[];
  /** "Batch made…", or why two lines can't be batched. */
  onNotice: (text: string) => void;
}

/**
 * Drop one line on another to make a batch (board eddie-oct22-wave2, fix 9):
 * hold a dragged line over another (useDragMergeDwell) and it lights up; let
 * go and the two are one batch line, its sheet open. A line dropped on a
 * batch is asked about first. The sheet saves, renames or splits it back.
 */
export function useLineBatches({ draft, set, enabled, heights, onNotice }: Options) {
  const dwell = useDragMergeDwell(enabled);
  const dragging = useRef<number | null>(null);
  const [open, setOpen] = useState<{ key: string; fresh: boolean; ask: string | null } | null>(null);
  const line = open ? draft.lines.find((l) => l.key === open.key && isBatch(l)) ?? null : null;
  const ask = open?.ask ? draft.lines.find((l) => l.key === open.ask) ?? null : null;
  const replace = (key: string, next: WizardLine) => set({ lines: draft.lines.map((l) => (l.key === key ? next : l)) });

  /** From DragRow as a line moves: which line it's held over. */
  const over = (from: number, dy: number | null) => {
    if (dy === null) {
      dragging.current = null;
      dwell.onHover(null);
      return;
    }
    if (dragging.current !== from) {
      dragging.current = from;
      dwell.onDragBegin(from);
    }
    dwell.onHover(overIndex(from, dy, heights()));
  };

  /** A line let go: true when it was dropped on another (batched), false to reorder. */
  const drop = (from: number): boolean => {
    const hit = dwell.consumeMergeOnDragEnd(from);
    dragging.current = null;
    const a = hit ? draft.lines[hit.from] : undefined;
    const b = hit ? draft.lines[hit.target] : undefined;
    if (!a || !b) return false;
    const why = cannotBatch(a) ?? cannotBatch(b);
    if (why) onNotice(why);
    else if (isBatch(a) || isBatch(b)) {
      const batch = isBatch(b) ? b : a;
      setOpen({ key: batch.key, fresh: false, ask: (batch === b ? a : b).key });
    } else {
      const lines = dropInto(draft.lines, a.key, b.key, draft.name);
      set({ lines });
      const made = lines.find((l) => !draft.lines.includes(l));
      if (made) setOpen({ key: made.key, fresh: true, ask: null });
    }
    return true;
  };

  const sheet = {
    line,
    drinkName: draft.name,
    fresh: !!open?.fresh,
    ask,
    onClose: () => setOpen(null),
    onAddIn: () => {
      if (!line || !ask) return;
      set({ lines: dropInto(draft.lines, ask.key, line.key, draft.name) });
      setOpen({ key: line.key, fresh: !!open?.fresh, ask: null });
    },
    onSave: (name: string, bottle: number) => {
      if (!line?.prep) return;
      replace(line.key, { ...line, name, prep: withBottle(line.prep, bottle) });
      setOpen(null);
      // Saved with the drink, like any prep made here (canvas make-create-house-line).
      onNotice(`${name} goes in your preps when you save the drink.`);
    },
    onSplit: () => {
      if (line) set({ lines: splitBatch(draft.lines, line.key) });
      setOpen(null);
    },
  };

  return {
    over,
    drop,
    /** The line a drag is held over, lit as "Drop to batch". */
    target: dwell.mergeTargetIndex,
    edit: (key: string) => setOpen({ key, fresh: false, ask: null }),
    hint: enabled ? HINT.batch : HINT.order,
    sheet,
  };
}
