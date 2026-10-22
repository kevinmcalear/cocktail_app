import { useEffect, useState } from 'react';

import { useDragMergeDwell } from '@/hooks/useDragMergeDwell';
import { mergeLines, splitBatch } from '@/lib/batchLines';
import { overIndex } from '@/lib/dropIndex';
import type { StepProps, WizardLine } from '@/lib/drinkWizard';

import { BatchAddSheet, BatchSheet } from './BatchSheet';
import { WizardNotice } from './WizardChrome';

/** How long "Batch saved" stays, as the wizard's other notices do. */
const NOTICE_MS = 10000;

/**
 * Drop one line on another to make a batch (board fix 9): hold a dragged line
 * over another for the dwell and it lights up "Drop to batch"; let go and the
 * two become one batch line, with its sheet open. A line dropped on a batch
 * asks first. `onDrop` says whether the drop was a batch, so the caller
 * reorders only when it wasn't.
 */
export function useBatchDrop({ draft, set, enabled, heights }: StepProps & { enabled: boolean; heights: () => number[] }) {
  const dwell = useDragMergeDwell(enabled);
  const [openKey, setOpenKey] = useState<string | null>(null);
  /** The batch just saved: "Batch saved … Open" for a moment. */
  const [savedKey, setSavedKey] = useState<string | null>(null);
  useEffect(() => {
    if (!savedKey) return;
    const t = setTimeout(() => setSavedKey(null), NOTICE_MS);
    return () => clearTimeout(t);
  }, [savedKey]);
  const [adding, setAdding] = useState<{ from: string; onto: string } | null>(null);
  const lines = draft.lines;
  const indexOf = (key: string) => lines.findIndex((l) => l.key === key);

  const onMove = (from: number, dy: number) => {
    const over = overIndex(from, dy, heights());
    // Only a line it can batch with lights up; anything else is a plain reorder.
    dwell.hover(over !== null && mergeLines(lines, from, over, draft.name) ? over : null);
  };
  const onDrop = (from: number): boolean => {
    const onto = dwell.release();
    if (onto === null) return false;
    const merged = mergeLines(lines, from, onto, draft.name);
    if (!merged) return false;
    if (lines[from].batch || lines[onto].batch) setAdding({ from: lines[from].key, onto: lines[onto].key });
    else {
      set({ lines: merged });
      setOpenKey(lines[onto].key);
    }
    return true;
  };
  // A name left empty goes back to the drink's.
  const close = () => {
    const l = openKey ? lines.find((x) => x.key === openKey) : null;
    if (l && !l.name.trim()) set({ lines: lines.map((x) => (x.key === l.key ? { ...x, name: `${draft.name.trim() || 'House'} batch` } : x)) });
    setOpenKey(null);
  };
  const open = openKey ? (lines.find((l) => l.key === openKey && l.batch) ?? null) : null;
  // The line going in the bottle, and the batch, whichever was dropped on which.
  const [dropped, dropTarget] = adding ? [lines[indexOf(adding.from)], lines[indexOf(adding.onto)]] : [];
  const asking = dropped && dropTarget ? (dropTarget.batch ? { line: dropped, batch: dropTarget } : { line: dropTarget, batch: dropped }) : null;

  const sheets = (
    <>
      {/* In the flow under the lines, like the wizard's other notices: a toast would sit behind the wizard's iOS modal. */}
      {/* ponytail: the prep is made when the drink is saved (as every prep made here is), so Open is the batch again, not its prep page. */}
      {savedKey && lines.some((l) => l.key === savedKey && l.batch) ? (
        <WizardNotice action={{ label: 'Open', onPress: () => setOpenKey(savedKey) }}>Batch saved. It’s in Preps once the drink is saved.</WizardNotice>
      ) : null}
      <BatchSheet
        line={open}
        drinkName={draft.name}
        onChange={(line: WizardLine) => set({ lines: lines.map((l) => (l.key === line.key ? line : l)) })}
        onSave={() => {
          setSavedKey(openKey);
          close();
        }}
        onSplit={() => {
          if (openKey) set({ lines: splitBatch(lines, openKey) });
          setOpenKey(null);
        }}
        onClose={close}
      />
      <BatchAddSheet
        adding={asking}
        onAdd={() => {
          const merged = adding ? mergeLines(lines, indexOf(adding.from), indexOf(adding.onto), draft.name) : null;
          if (merged) set({ lines: merged });
          setAdding(null);
        }}
        onClose={() => setAdding(null)}
      />
    </>
  );
  return { onMove, onDrop, target: dwell.mergeTargetIndex, open: setOpenKey, sheets };
}
