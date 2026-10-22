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
 * The row a dragged row is held over, to drop it on (a batch): the one whose
 * middle half its centre is in. Null over its own place or between rows, so
 * passing over a row on the way to reorder never counts.
 */
export function overIndex(from: number, dy: number, heights: readonly number[]): number | null {
  let top = 0;
  const tops = heights.map((h) => (top += h) - h);
  const centre = (tops[from] ?? 0) + (heights[from] ?? 0) / 2 + dy;
  const at = heights.findIndex((h, i) => i !== from && centre >= tops[i] + h / 4 && centre <= tops[i] + (3 * h) / 4);
  return at < 0 ? null : at;
}
