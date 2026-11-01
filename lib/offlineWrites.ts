/**
 * Behind-the-bar writes that work with no signal: they show at once, wait on
 * the phone, survive the app closing, and send when there's signal again
 * (hooks/barWrites.ts sends them, lib/react-query.ts registers them). Each
 * carries ids made on the phone, so sending one twice changes nothing.
 */

/** Every bar write's key starts with this, so the pending state can find them all. */
export const BAR_WRITE = 'bar-write';

/**
 * A write that failed for want of signal, not because the database said no:
 * it waits and tries again rather than being lost. supabase-js reports a
 * failed fetch as an error with no code and the fetch's own message.
 */
export function isNetworkError(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown; name?: unknown } | null;
  if (!e) return false;
  if (typeof e.code === 'string' && e.code !== '') return false;
  const message = `${typeof e.name === 'string' ? e.name : ''} ${typeof e.message === 'string' ? e.message : ''}`;
  return /network request failed|failed to fetch|load failed|network ?error|timed? ?out|aborted|internet connection/i.test(message);
}

/**
 * A spec as the editor loaded it, as one string: two loads of the same spec
 * match, so an edit kept offline can tell whether someone changed the spec
 * since. Key order doesn't matter.
 */
export function specFingerprint(form: unknown): string {
  const sorted = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sorted)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted((v as Record<string, unknown>)[k])]))
        : v;
  return JSON.stringify(sorted(form));
}

/** Bar writes try again on a dropped connection (waiting while there's none), never on a refusal. */
export const retryBarWrite = (failures: number, error: unknown) => isNetworkError(error) && failures < 5;
