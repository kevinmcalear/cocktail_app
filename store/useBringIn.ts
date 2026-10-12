import { create } from 'zustand';

import type { HomeNight } from '@/hooks/useMenuMutations';
import type { SavedBringIn } from '@/hooks/useBringInSave';

import { isCleanText, isLink, localReading, readingName, type ReadKind, type ReadSource } from '@/lib/bringIn';
import { appendReading } from '@/lib/paste';
import { nudgeWhenReady } from '@/lib/readyNudge';
import { MAX_READ_FILES, readAnything, type AnythingReading, type ReadFile } from '@/lib/readAnything';

export type { ReadSource };

export interface BringInJob {
  id: number;
  /** The venue it comes into; null for your home bar. */
  barId: string | null;
  source: ReadSource;
  /** What the person said it is ("Reading as"), else null. */
  as: ReadKind | null;
  /** The screen it started from, a nudge for the reader. */
  hint: ReadKind | null;
  status: 'reading' | 'ready' | 'failed';
  /** Clean text read on the phone, no AI. */
  local: boolean;
  reading: AnythingReading | null;
  error: string | null;
  /** Pages added while it was reading, read next. */
  more: ReadFile[];
  /** Started from New menu: the name and night it was given. */
  menu: { name: string; night: HomeNight | null } | null;
}

interface BringInState {
  sheet: boolean;
  job: BringInJob | null;
  /** The next things to check, one after another (several files dropped at once). */
  queue: ReadSource[];
  /** The Reading view or a check is on screen; otherwise the tray shows. */
  foreground: boolean;
  /** The last save, for Brought in (and when it couldn't be recorded as a batch). */
  done: SavedBringIn | null;
  setDone: (done: SavedBringIn | null) => void;
  openSheet: () => void;
  closeSheet: () => void;
  start: (source: ReadSource, where: { barId: string | null; hint?: ReadKind | null; as?: ReadKind | null; menu?: BringInJob['menu'] }) => void;
  readAs: (kind: ReadKind) => void;
  addPages: (files: ReadFile[]) => void;
  retry: () => void;
  /** Drops the job (Close, Cancel, or after Brought in), and the queue with it unless `keepQueue`. */
  clear: (keepQueue?: boolean) => void;
  enqueue: (sources: ReadSource[]) => void;
  /** Starts the next queued source, if any. True when one started. */
  next: (barId: string | null) => boolean;
  setForeground: (on: boolean) => void;
}

let ids = 0;

/** Two readings of more pages of one thing, as one. Different kinds keep the first. */
export function mergeReadings(a: AnythingReading | null, b: AnythingReading): AnythingReading {
  if (!a || a.kind !== b.kind) return a ?? b;
  if (a.kind === 'menu' && a.menu && b.menu) {
    return { ...a, menu: { title: a.menu.title ?? b.menu.title, sections: appendReading(a.menu.sections, b.menu.sections) }, skipped: [...(a.skipped ?? []), ...(b.skipped ?? [])] };
  }
  return { ...a, recipes: [...a.recipes, ...b.recipes], bottles: [...a.bottles, ...b.bottles], unreadable: [...(a.unreadable ?? []), ...(b.unreadable ?? [])] };
}

/** Pages offset so places from a later call point at the right file. */
function offsetPages(reading: AnythingReading, by: number): AnythingReading {
  if (!by) return reading;
  const move = <T extends { at?: { page: number; box: [number, number, number, number] } | null }>(x: T): T => (x.at ? { ...x, at: { ...x.at, page: x.at.page + by } } : x);
  return {
    ...reading,
    menu: reading.menu ? { ...reading.menu, sections: reading.menu.sections.map((s) => ({ ...s, lines: s.lines.map(move) })) } : null,
    recipes: reading.recipes.map((r) => ({ ...move(r), lines: r.lines.map(move) })),
    bottles: reading.bottles.map(move),
    skipped: reading.skipped?.map(move),
    unreadable: reading.unreadable?.map(move),
  };
}

/** Reads files in calls of up to four, then text or a link, merging what comes back. */
async function readAll(source: ReadSource, hint: ReadKind | null, as: ReadKind | null, firstPage: number): Promise<AnythingReading> {
  if (!source.files.length) return readAnything({ text: source.text ?? '', url: source.url ?? undefined, hint, as });
  let out: AnythingReading | null = null;
  for (let i = 0; i < source.files.length; i += MAX_READ_FILES) {
    const part = await readAnything({ files: source.files.slice(i, i + MAX_READ_FILES), hint, as: as ?? out?.kind ?? null });
    out = mergeReadings(out, offsetPages(part, firstPage + i));
  }
  return out!;
}

/**
 * Bring in's reading, kept here rather than on a screen so it carries on
 * while you use the rest of the app (the tray shows it), and the sheet's open
 * state so any screen can open it.
 */
export const useBringIn = create<BringInState>()((set, get) => {
  const patch = (id: number, change: Partial<BringInJob>) => {
    const job = get().job;
    if (job?.id === id) set({ job: { ...job, ...change } });
  };

  const run = async (id: number, pages: ReadFile[], firstPage: number) => {
    const job = get().job;
    if (!job || job.id !== id) return;
    try {
      const source = firstPage ? { files: pages, text: null, url: null } : { ...job.source, files: pages };
      const reading = await readAll(source, job.hint, job.as, firstPage);
      const now = get().job;
      if (!now || now.id !== id) return;
      const merged = firstPage ? mergeReadings(now.reading, reading) : reading;
      // Pages added while it read are read now, from where these left off.
      if (now.more.length) {
        const more = now.more;
        const at = now.source.files.length;
        set({ job: { ...now, reading: merged, more: [], source: { ...now.source, files: [...now.source.files, ...more] } } });
        return run(id, more, at);
      }
      set({ job: { ...now, status: 'ready', reading: merged, error: null } });
      if (!get().foreground) nudgeWhenReady(readingName(merged));
    } catch (e) {
      patch(id, { status: 'failed', error: e instanceof Error ? e.message : 'Couldn’t read that. Try again.' });
    }
  };

  const begin = (job: BringInJob) => {
    set({ job, sheet: false });
    if (job.local) return;
    void run(job.id, job.source.files, 0);
  };

  return {
    sheet: false,
    job: null,
    queue: [],
    foreground: false,
    done: null,
    setDone: (done) => set({ done }),
    openSheet: () => set({ sheet: true }),
    closeSheet: () => set({ sheet: false }),
    start: (source, where) => {
      const text = source.text?.trim() ?? '';
      const url = source.url ?? (isLink(text) ? text : null);
      const local = !source.files.length && !url && isCleanText(text);
      const as = where.as ?? null;
      begin({
        id: ++ids,
        barId: where.barId,
        source: { ...source, text: url ? null : text || null, url },
        as,
        hint: where.hint ?? null,
        status: local ? 'ready' : 'reading',
        local,
        reading: local ? localReading(text, as) : null,
        error: null,
        more: [],
        menu: where.menu ?? null,
      });
    },
    readAs: (kind) => {
      const job = get().job;
      if (!job || (job.reading?.kind === kind && job.status === 'ready')) return;
      if (job.local) return set({ job: { ...job, as: kind, reading: localReading(job.source.text ?? '', kind) } });
      begin({ ...job, id: ++ids, as: kind, status: 'reading', reading: null, error: null, more: [] });
    },
    addPages: (files) => {
      const job = get().job;
      if (!job || job.local || !files.length) return;
      if (job.status === 'reading') return set({ job: { ...job, more: [...job.more, ...files] } });
      const at = job.source.files.length;
      set({ job: { ...job, status: 'reading', source: { ...job.source, files: [...job.source.files, ...files] } } });
      void run(job.id, files, at);
    },
    retry: () => {
      const job = get().job;
      if (job) begin({ ...job, id: ++ids, status: 'reading', reading: null, error: null, more: [] });
    },
    clear: (keepQueue = false) => set((s) => ({ job: null, queue: keepQueue ? s.queue : [] })),
    enqueue: (sources) => set((s) => ({ queue: [...s.queue, ...sources] })),
    next: (barId) => {
      const [first, ...rest] = get().queue;
      if (!first) return false;
      set({ queue: rest });
      get().start(first, { barId });
      return true;
    },
    setForeground: (on) => set({ foreground: on }),
  };
});
