/**
 * Work that can wait, run in short slices when the app is idle (RAIL: idle
 * work in chunks well under 50 ms, so a tap or a frame is never held up). A
 * list of thumbnails queues its paintings here instead of painting them all
 * in one long render. Checked by lib/idleQueue.check.ts.
 */

/** How long one slice may run, in ms. */
export const SLICE_MS = 8;

const jobs: (() => void)[] = [];
let pending = false;

type Later = (run: () => void) => void;
const later: Later =
  typeof requestIdleCallback === 'function'
    ? (run) => requestIdleCallback(run, { timeout: 250 }) // a busy screen still gets its pictures within a quarter second
    : (run) => setTimeout(run, 1);

function run(schedule: Later, now: () => number) {
  const end = now() + SLICE_MS;
  // At least one job per slice, so one slow job can't stall the rest.
  do jobs.shift()?.();
  while (jobs.length && now() < end);
  pending = jobs.length > 0;
  if (pending) schedule(() => run(schedule, now));
}

/** Runs `job` in a coming idle slice, after the jobs queued before it. */
export function whenIdle(job: () => void, schedule: Later = later, now: () => number = () => performance.now()) {
  jobs.push(job);
  if (pending) return;
  pending = true;
  schedule(() => run(schedule, now));
}

type Fetching = { isFetching: () => number; getQueryCache: () => { subscribe: (listener: () => void) => () => void } };

/**
 * Runs `run` once the first screen's queries have fetched and settled (or
 * after `maxMs`), so a download that can wait (the fonts later screens use)
 * doesn't share a slow connection with the first screen's data. Returns a
 * cancel.
 */
export function afterFirstData(client: Fetching, run: () => void, maxMs = 4000): () => void {
  let fetched = false;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    unsubscribe();
    clearTimeout(timer);
    run();
  };
  const timer = setTimeout(finish, maxMs);
  const unsubscribe = client.getQueryCache().subscribe(() => {
    if (client.isFetching() > 0) fetched = true;
    else if (fetched) finish();
  });
  return () => {
    done = true;
    unsubscribe();
    clearTimeout(timer);
  };
}
