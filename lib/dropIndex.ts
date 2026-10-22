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
 * The row a dragged one is held over, to drop it on (a batch): its middle
 * within the middle half of another row. Null between rows, so a drag that
 * passes through to reorder never lands on one.
 */
export function overIndex(from: number, dy: number, heights: readonly number[]): number | null {
  let top = 0;
  const tops = heights.map((h) => (top += h) - h);
  const middle = (tops[from] ?? 0) + (heights[from] ?? 0) / 2 + dy;
  const i = heights.findIndex((h, k) => k !== from && h > 0 && middle >= tops[k] + h / 4 && middle <= tops[k] + (h * 3) / 4);
  return i < 0 ? null : i;
}
