import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useDragMergeDwell } from '@/hooks/useDragMergeDwell';
import { combinable, combineLines } from '@/lib/batchLines';
import { dragSlot, dropIndex, gapShift } from '@/lib/dropIndex';
import type { StepProps, WizardLine } from '@/lib/drinkWizard';

/**
 * A held line, and where it goes (make-anything-steps-1, step 3). The other
 * lines slide aside to show where it lands (lib/dropIndex dragSlot); held
 * over another for the dwell, the pop-up says "Let go to make it in-house"
 * with both names, and letting go makes the two one line and `onCombined`
 * opens its recipe steps. `onDrop` gives the place to move it to, or null
 * when it combined. `enabled` off (a recipe's lines) only reorders.
 */
export function useCombineDrop({ draft, set, enabled, heights, onCombined }: StepProps & { enabled: boolean; heights: () => number[]; onCombined: (line: WizardLine) => void }) {
  const dwell = useDragMergeDwell(enabled);
  // The line being held, where its gap is and how tall: for the pop-up's "Tempus Fugit + Red miso" and the lines sliding aside.
  const [held, setHeld] = useState<{ from: number; slot: number; gap: number } | null>(null);
  // The same, read between renders: a drag reports every frame.
  const heldRef = useRef(held);
  const lines = draft.lines;

  const onMove = (from: number, dy: number) => {
    const was = heldRef.current;
    const rows = heights();
    const at = dragSlot(from, dy, rows, was?.from === from ? was.slot : from);
    if (was?.from !== from || was.slot !== at.slot) {
      // A tick as a line slides aside, as iOS lists do.
      if (was && Platform.OS !== 'web') void Haptics.selectionAsync();
      heldRef.current = { from, slot: at.slot, gap: rows[from] ?? 0 };
      setHeld(heldRef.current);
    }
    // Only a line it can combine with lights up; anything else is a plain reorder.
    dwell.hover(at.over !== null && combinable(lines, from, at.over) ? at.over : null);
  };
  const onDrop = (from: number, dy: number): number | null => {
    const to = heldRef.current?.from === from ? heldRef.current.slot : dropIndex(from, dy, heights());
    heldRef.current = null;
    setHeld(null);
    const onto = dwell.release();
    const merged = onto === null ? null : combineLines(lines, from, onto, draft.name);
    const line = onto === null ? undefined : merged?.find((l) => l.key === lines[onto].key);
    if (!merged || !line) return to;
    set({ lines: merged });
    onCombined(line);
    return null;
  };
  const target = dwell.mergeTargetIndex;
  return {
    onMove,
    onDrop,
    target,
    holding: target !== null && held !== null ? (lines[held.from]?.name ?? null) : null,
    // For the held line's own card: the name of the line letting go would combine it with.
    combineWith: (i: number) => (target !== null && held?.from === i ? (lines[target]?.name ?? null) : null),
    // How far line i slides aside while another is held; null when nothing is, so the lines settle at once into their new order.
    shift: (i: number) => (held ? gapShift(i, held.from, held.slot, held.gap) : null),
  };
}
