/**
 * A scheduler that runs everything asked of it before its timer fires on that
 * one timer. TanStack Query tells its subscribers about each query's result
 * on a timer of its own (setTimeout 0 per query), and React Native runs every
 * timer as a separate task, so a list of rows that each read a query (a
 * drink's sketch, its photo, a bar's logo) committed once per row: 60 rows
 * landing together were 60 commits and 60 layouts of the whole screen, over a
 * second with the screen frozen. On one timer they're one commit.
 * Checked by lib/coalesceTimer.check.ts.
 */
export function coalesceTimer(later: (run: () => void) => void = (run) => setTimeout(run, 0)) {
  let queue: (() => void)[] = [];
  return (callback: () => void) => {
    queue.push(callback);
    if (queue.length > 1) return;
    later(() => {
      const run = queue;
      queue = [];
      for (const fn of run) fn();
    });
  };
}
