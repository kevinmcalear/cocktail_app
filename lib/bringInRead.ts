// Reading what Bring in was given (store/useBringIn.ts): files in calls of up
// to four, then text or a link, merged into one reading. The store loads this
// on its first read, so the reader stays off every page's first load.

import type { ReadKind, ReadSource } from '@/lib/bringIn';
import { appendReading } from '@/lib/paste';
import { MAX_READ_FILES, readAnything, type AnythingReading } from '@/lib/readAnything';

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
    recipes: reading.recipes.map((r) => ({ ...move(r), lines: r.lines.map(move), ...(r.batch ? { batch: { ...move(r.batch), lines: r.batch.lines.map(move) } } : {}) })),
    bottles: reading.bottles.map(move),
    skipped: reading.skipped?.map(move),
    unreadable: reading.unreadable?.map(move),
  };
}

/** Reads files in calls of up to four, then text or a link, merging what comes back. */
export async function readAll(source: ReadSource, hint: ReadKind | null, as: ReadKind | null, firstPage: number): Promise<AnythingReading> {
  if (!source.files.length) return readAnything({ text: source.text ?? '', url: source.url ?? undefined, hint, as });
  let out: AnythingReading | null = null;
  for (let i = 0; i < source.files.length; i += MAX_READ_FILES) {
    const part = await readAnything({ files: source.files.slice(i, i + MAX_READ_FILES), hint, as: as ?? out?.kind ?? null });
    out = mergeReadings(out, offsetPages(part, firstPage + i));
  }
  return out!;
}
