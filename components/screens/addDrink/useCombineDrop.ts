import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Platform } from 'react-native';

import { useDragMergeDwell } from '@/hooks/useDragMergeDwell';
import { combinable, combineLines } from '@/lib/batchLines';
import { dropEntry, linePart, partEntries, slotPart, toggleLine, type PartEntry } from '@/lib/drinkParts';
import { dragSlot, dropIndex, gapShift } from '@/lib/dropIndex';
import type { StepProps, WizardLine } from '@/lib/drinkWizard';

/**
 * A held line, and where it goes (make-anything-steps-1, step 3). The other
 * lines slide aside to show where it lands (lib/dropIndex dragSlot); held
 * over another for the dwell, the pop-up says "Let go to make it in-house"
 * with both names, and letting go makes the two one line and `onCombined`
 * opens its recipe steps; let go anywhere else, it moves there. `enabled`
 * off (a recipe's lines) only reorders.
 *
 * `parted`: the drink editor's spec made in parts (drink-edit-parts). The
 * rows are the lines and, between them, each later part's heading
 * (lib/drinkParts partEntries), so indexes here are rows, not lines. A
 * heading slides aside like a line, and a line let go past one lands in
 * that part; over a line it still combines.
 */
export function useCombineDrop({ draft, set, enabled, onCombined, parted }: StepProps & { enabled: boolean; onCombined: (line: WizardLine) => void; parted?: boolean }) {
  const dwell = useDragMergeDwell(enabled);
  // The row being held, where its gap is and how tall: for the pop-up's "Tempus Fugit + Red miso" and the rows sliding aside.
  const [held, setHeld] = useState<{ from: number; slot: number; gap: number } | null>(null);
  // The same, read between renders: a drag reports every frame.
  const heldRef = useRef(held);
  const lines = draft.lines;
  const parts = parted && draft.parts?.length ? draft.parts : null;
  const entries = partEntries(parts, lines.map((l) => l.key));
  // Each row's height says where a dragged one lands: a line's by its key, a heading's by its part.
  const heights = useRef<Record<string, number>>({});
  const idOf = (e: PartEntry) => ('line' in e ? (lines[e.line]?.key ?? '') : `part:${e.part}`);
  const rowHeights = () => entries.map((e) => heights.current[idOf(e)] ?? 0);
  const lineAt = (row: number): number | null => {
    const e = entries[row];
    return e && 'line' in e ? e.line : null;
  };

  // Row `from` (a line) put at `to` among the others: the spec's order, which is what saves and what the drawing pours, and in parts the part it lands in.
  const place = (from: number, to: number) => {
    const line = lineAt(from);
    if (line === null || to < 0 || to >= entries.length || to === from) return;
    const { order, part } = dropEntry(entries, from, to);
    const key = lines[line].key;
    const moved = parts && linePart(parts, key, false) !== part;
    set({ lines: order.map((i) => lines[i]), ...(moved ? { parts: toggleLine(parts, part - 1, key) } : null) });
  };

  const onMove = (from: number, dy: number) => {
    const was = heldRef.current;
    const rows = rowHeights();
    const at = dragSlot(from, dy, rows, was?.from === from ? was.slot : from);
    if (was?.from !== from || was.slot !== at.slot) {
      // A tick as a row slides aside, as iOS lists do.
      if (was && Platform.OS !== 'web') void Haptics.selectionAsync();
      heldRef.current = { from, slot: at.slot, gap: rows[from] ?? 0 };
      setHeld(heldRef.current);
    }
    // Only a line it can combine with lights up; anything else, a heading too, is a plain move.
    const self = lineAt(from);
    const onto = at.over === null ? null : lineAt(at.over);
    dwell.hover(self !== null && onto !== null && combinable(lines, self, onto) ? onto : null);
  };
  const onDrop = (from: number, dy: number) => {
    const to = heldRef.current?.from === from ? heldRef.current.slot : dropIndex(from, dy, rowHeights());
    heldRef.current = null;
    setHeld(null);
    const onto = dwell.release();
    const self = lineAt(from);
    const merged = onto === null || self === null ? null : combineLines(lines, self, onto, draft.name);
    const line = onto === null ? undefined : merged?.find((l) => l.key === lines[onto].key);
    if (!merged || !line) return place(from, to);
    // The one line takes the place, and the part, of the line it was let go on.
    set({ lines: merged });
    onCombined(line);
  };
  const target = dwell.mergeTargetIndex;
  const heldLine = held ? lineAt(held.from) : null;
  const landsIn = held && parts ? slotPart(entries, held.from, held.slot) : null;
  return {
    /** The rows top to bottom: each line, and in parts each later part's heading. */
    entries,
    onMove,
    onDrop,
    /** The arrow keys and a screen reader's actions: a line one row up or down, into the next part past its heading. */
    step: (row: number, by: -1 | 1) => place(row, row + by),
    height: (e: PartEntry, h: number) => void (heights.current[idOf(e)] = h),
    /** The line letting go would combine with (a line's index). */
    target,
    holding: target !== null && heldLine !== null ? (lines[heldLine]?.name ?? null) : null,
    // For the held line's own card: the name of the line letting go would combine it with.
    combineWith: (i: number) => (target !== null && heldLine === i ? (lines[target]?.name ?? null) : null),
    // How far row i slides aside while another is held; null when nothing is, so the rows settle at once into their new order.
    shift: (i: number) => (held ? gapShift(i, held.from, held.slot, held.gap) : null),
    /** In parts: the part the held line would land in, when it's another part than its own. */
    moveTo: landsIn !== null && heldLine !== null && parts && landsIn !== linePart(parts, lines[heldLine].key, false) ? landsIn : null,
  };
}
