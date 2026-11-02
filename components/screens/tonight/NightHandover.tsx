import { useState, type ReactNode } from 'react';

import { useHandoverRows } from '@/hooks/useHandoverRows';
import { toDay } from '@/lib/collection';

import { HandoverPart } from './HandoverPartsLazy';
import type { useStaffTonight } from './useStaffTonight';

export interface NightHandover {
  /** On top of Tonight until read. */
  card: ReactNode;
  /** At the end once read, and during service. */
  section: ReactNode;
  /** After close, leading: Leave the handover. */
  leave: ReactNode;
  /** Wide web: the note beside Tonight while it's open (Loop-tonight-desk), else null. */
  pane: ReactNode;
  /** The sheets: the note (phones), and writing your part. */
  sheets: ReactNode;
}

/** What the handover's parts share: the night and which of the note is open. Each part reads the note itself (useHandover). */
export interface HandoverState {
  t: ReturnType<typeof useStaffTonight>;
  barId: string;
  wide: boolean;
  reading: boolean;
  setReading: (on: boolean) => void;
  /** The close being written for, or null. */
  writing: string | null;
  setWriting: (closeDate: string | null) => void;
  /** iOS shows one sheet at a time: the writing sheet waits for the note's to go. */
  next: string | null;
  setNext: (closeDate: string | null) => void;
}

/**
 * Tonight's handover (Loop-handover): the note from the last close on top
 * until read, Got it, Add to it, and Leave the handover after close. On
 * phones the note opens in a sheet; wide, beside Tonight (Loop-tonight-desk).
 * Only the week's rows and what's open live here: a part renders once there
 * is a note (or an error) to show, and on the web loads then
 * (HandoverPartsLazy.web.tsx), so Tonight's first load carries none of it.
 */
export function useNightHandover(t: HandoverState['t'], barId: string, wide: boolean): NightHandover {
  const rows = useHandoverRows(barId, t.date ? toDay(t.date) : null);
  const [reading, setReading] = useState(false);
  const [writing, setWriting] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const s: HandoverState = { t, barId, wide, reading, setReading, writing, setWriting, next, setNext };
  const any = !!rows.data?.length || rows.isError;
  return {
    // Wide, the note open beside Tonight replaces its card.
    card: any && !(wide && reading) ? <HandoverPart which="card" s={s} /> : null,
    section: any ? <HandoverPart which="section" s={s} /> : null,
    // Not while loading: the sheet starts from what you left, so it waits for it.
    leave: t.date && !rows.isLoading ? <HandoverPart which="leave" s={s} /> : null,
    pane: wide && reading ? <HandoverPart which="pane" s={s} /> : null,
    sheets: <HandoverPart which="sheets" s={s} />,
  };
}
