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
