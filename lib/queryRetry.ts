// When a failed read is tried again. A database near its memory limit answers
// slowly or with 5xx; every retry then adds load, so give up early on those.
// Answers about the request (4xx, PostgREST codes, "no rows") never change.

interface Failure {
  status?: number;
  code?: string;
  message?: string;
}

const SLOW = /timeout|timed out|canceling statement|out of memory|too many connections/i;

/** Failures that retrying can't fix: bad request, signed out, forbidden, missing, or a PostgREST answer. */
export function isFinalFailure(error: unknown): boolean {
  const e = (error ?? {}) as Failure;
  if (typeof e.status === 'number' && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) return true;
  // PGRST* (PostgREST) and SQLSTATE classes 2x and 4x (auth, permission, constraint, missing) are answers;
  // class 40 (serialization failure, deadlock) clears by itself.
  return typeof e.code === 'string' && /^(PGRST|2|4)/.test(e.code) && !e.code.startsWith('40');
}

/** Overload signs: timeouts, 5xx (544 is Supabase's), statement timeout (SQLSTATE 57014). */
export function isOverload(error: unknown): boolean {
  const e = (error ?? {}) as Failure;
  return (typeof e.status === 'number' && e.status >= 500) || e.code === '57014' || SLOW.test(e.message ?? '');
}

/** TanStack `retry` for queries: never on a final answer, once on overload, twice on a network glitch. */
export function retryQuery(failures: number, error: unknown): boolean {
  if (isFinalFailure(error)) return false;
  return failures < (isOverload(error) ? 1 : 2);
}

/** TanStack `retryDelay`: 1 s, 2 s, 4 s... up to 30 s, with up to 50% jitter either side so clients don't retry together. */
export function retryDelay(failures: number, random: () => number = Math.random): number {
  const base = Math.min(1000 * 2 ** failures, 30_000);
  return Math.round(base * (0.5 + random()));
}
