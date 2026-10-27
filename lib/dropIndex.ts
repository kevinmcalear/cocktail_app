/**
 * Where a dragged row lands: from its index, moved by `dy` points, over rows
 * of these heights. It passes a neighbour once it's dragged past half of it.
 */
export function dropIndex(from: number, dy: number, heights: readonly number[]): number {
  let at = from;
  let left = dy;
  while (left > 0 && at < heights.length - 1 && left > (heights[at + 1] ?? 0) / 2) {
    left -= heights[at + 1] ?? 0;
    at += 1;
  }
  if (dy > 0) return at;
  while (left < 0 && at > 0 && -left > (heights[at - 1] ?? 0) / 2) {
    left += heights[at - 1] ?? 0;
    at -= 1;
  }
  return at;
}

/**
 * Where a dragged row would land while the others make room for it (Kevin,
 * 27 Oct: drag options 3B). The rows it passes slide over its gap, so the gap
 * is where it lands: past three quarters of a row, that row slides. A row's
 * middle half is for dropping on it (a batch): `over` is that row, else null,
 * and its own place never counts. `slot` is where the gap was before this
 * move, so a row that just slid doesn't slide back under a still finger.
 */
export function dragSlot(from: number, dy: number, heights: readonly number[], slot: number): { slot: number; over: number | null } {
  const gap = heights[from] ?? 0;
  const rest = heights.map((_, i) => i).filter((i) => i !== from);
  const centre = heights.slice(0, from).reduce((a, h) => a + h, 0) + gap / 2 + dy;
  // The rows' tops with the gap before rest[at].
  const tops = (at: number) => {
    let top = 0;
    return rest.map((i, k) => {
      if (k === at) top += gap;
      return (top += heights[i] ?? 0) - (heights[i] ?? 0);
    });
  };
  let at = Math.max(0, Math.min(slot, rest.length));
  for (let pass = 0; pass <= rest.length * 2; pass++) {
    const t = tops(at);
    const k = rest.findIndex((i, k) => (k >= at ? centre > t[k] + ((heights[i] ?? 0) * 3) / 4 : centre < t[k] + (heights[i] ?? 0) / 4));
    if (k < 0) break;
    at = k >= at ? k + 1 : k;
  }
  const t = tops(at);
  const k = rest.findIndex((i, k) => centre >= t[k] + (heights[i] ?? 0) / 4 && centre <= t[k] + ((heights[i] ?? 0) * 3) / 4);
  return { slot: at, over: k < 0 ? null : rest[k] };
}

/** How far row `i` slides to make room while row `from` (`gap` tall) is held with its gap at `slot` (dragSlot). */
export function gapShift(i: number, from: number, slot: number, gap: number): number {
  if (i === from) return 0;
  return (i > from ? -gap : 0) + ((i < from ? i : i - 1) >= slot ? gap : 0);
}
