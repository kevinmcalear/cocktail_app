/** Layout and keyboard helpers for the ⌘K / search grid (CommandSearch). */

/** True when a left/right arrow would move the caret inside a non-empty text field. */
export function caretCanMove(e: KeyboardEvent) {
  const t = e.target as HTMLInputElement | null;
  if (!t || t.tagName !== 'INPUT' || !t.value) return false;
  const start = t.selectionStart ?? 0;
  const end = t.selectionEnd ?? 0;
  if (start !== end) return true;
  return e.key === 'ArrowLeft' ? start > 0 : end < t.value.length;
}

/** Short age for a Recent card: 42s, 5m, 3h, 2d. */
export function timeAgo(at: number) {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Cards per row for the panel width. */
export function gridColumns(width: number) {
  if (width >= 720) return 6;
  if (width >= 520) return 5;
  if (width >= 400) return 4;
  return 3;
}
