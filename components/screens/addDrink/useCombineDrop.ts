import { useState } from 'react';

import { useDragMergeDwell } from '@/hooks/useDragMergeDwell';
import { combinable, combineLines } from '@/lib/batchLines';
import { overIndex } from '@/lib/dropIndex';
import type { StepProps, WizardLine } from '@/lib/drinkWizard';

/**
 * Drop one line on another to combine them into a house prep
 * (make-anything-steps-1, step 3): hold a dragged line over another for the
 * dwell and it says "Combine into a house prep" with both names; let go and
 * the two become one line, and `onCombined` opens its recipe steps. `onDrop`
 * says whether the drop combined, so the caller reorders only when it didn't.
 */
export function useCombineDrop({ draft, set, enabled, heights, onCombined }: StepProps & { enabled: boolean; heights: () => number[]; onCombined: (line: WizardLine) => void }) {
  const dwell = useDragMergeDwell(enabled);
  // The line being held, for the pop-up's "Tempus Fugit + Red miso".
  const [held, setHeld] = useState<number | null>(null);
  const lines = draft.lines;

  const onMove = (from: number, dy: number) => {
    const over = overIndex(from, dy, heights());
    setHeld(from);
    // Only a line it can combine with lights up; anything else is a plain reorder.
    dwell.hover(over !== null && combinable(lines, from, over) ? over : null);
  };
  const onDrop = (from: number): boolean => {
    setHeld(null);
    const onto = dwell.release();
    if (onto === null) return false;
    const merged = combineLines(lines, from, onto, draft.name);
    const line = merged?.find((l) => l.key === lines[onto].key);
    if (!merged || !line) return false;
    set({ lines: merged });
    onCombined(line);
    return true;
  };
  const target = dwell.mergeTargetIndex;
  return {
    onMove,
    onDrop,
    target,
    holding: target !== null && held !== null ? (lines[held]?.name ?? null) : null,
    // For the held line's own card: the name of the line letting go would combine it with.
    combineWith: (i: number) => (target !== null && held === i ? (lines[target]?.name ?? null) : null),
  };
}
