/**
 * Times the real search (Quality bar B6): from a letter typed in a search
 * field to its results on screen. Kept in memory only, the last 500 letters;
 * the /dev/search-bench screen shows them. Two clock reads a letter.
 */
const KEEP = 500;
const samples: number[] = [];
let typedAt: number | null = null;

/** A letter was typed (components/search/SearchField.tsx). */
export function searchTyped(): void {
  typedAt = performance.now();
}

/** Its results are on screen: called from an effect on the results (hooks/useMineSearch.ts). */
export function searchShown(): void {
  if (typedAt === null) return;
  samples.push(performance.now() - typedAt);
  typedAt = null;
  if (samples.length > KEEP) samples.shift();
}

/** The letters timed so far, in ms; null before any. */
export function searchTimings(): { letters: number; p50: number; p95: number; max: number } | null {
  if (!samples.length) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (p: number) => Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] * 10) / 10;
  return { letters: sorted.length, p50: at(0.5), p95: at(0.95), max: at(1) };
}

export function clearSearchTimings(): void {
  samples.length = 0;
  typedAt = null;
}
