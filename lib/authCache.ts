import type { User } from '@supabase/supabase-js';
import type { Query, QueryClient } from '@tanstack/react-query';

/**
 * The user in the session auth-js saved on this device (`raw` is its storage
 * value), or null. It's who the persisted query cache belongs to, so the
 * first screen can paint their cached data while auth-js refreshes an expired
 * token. Only the user is read: the tokens stay with auth-js, which still
 * refreshes before any request and drops the session if that fails. Mirrors
 * auth-js's own check that a stored session is usable.
 */
export function storedSessionUser(raw: string | null | undefined): User | null {
  if (!raw) return null;
  try {
    const s: unknown = JSON.parse(raw);
    if (!s || typeof s !== 'object') return null;
    const { access_token, refresh_token, expires_at, user } = s as Record<string, unknown>;
    if (typeof access_token !== 'string' || typeof refresh_token !== 'string' || !refresh_token) return null;
    if (typeof expires_at !== 'number') return null;
    if (!user || typeof user !== 'object' || typeof (user as { id?: unknown }).id !== 'string') return null;
    return user as User;
  } catch {
    return null;
  }
}

/**
 * Queries whose rows depend on who is signed in (RLS). Queries marked
 * `meta: { public: true }` (a venue's staff-link branding) are the same for
 * everyone and survive a change of user.
 */
export const isUserQuery = (query: Query) => query.meta?.public !== true;

/**
 * What the query cache must do when auth settles on `next` (a user id, or
 * null when signed out). `prev` is the user it last settled on, or undefined
 * on the first settle after launch.
 *
 * - clear: signed out (or opened signed out). Forget the previous user.
 * - reset: a different user signed in. Anything cached, or still in flight,
 *   was fetched as someone else (usually anon, which RLS answers with []).
 * - null: same user (token refresh, profile edit, relaunch while signed in).
 */
export function cacheActionOnAuth(
  prev: string | null | undefined,
  next: string | null,
): 'clear' | 'reset' | null {
  if (next === null) return prev === null ? null : 'clear';
  if (prev === undefined || prev === next) return null;
  return 'reset';
}

/**
 * Drops writes still waiting for a connection (offline edits). The Supabase
 * client attaches whoever is signed in when a write is sent, not when it was
 * made, so one queued by the previous user would go out as the next. Writes
 * already sent are left to finish.
 */
export function dropUnsentWrites(client: QueryClient): void {
  const writes = client.getMutationCache();
  for (const write of writes.getAll()) if (write.state.isPaused) writes.remove(write);
}

/**
 * Drops every user-scoped query's data and refetches the ones on screen.
 * Unlike invalidating, a reset also cancels fetches that started before the
 * session existed, so their anon result can't land and be cached for the
 * query's whole staleTime. Unsent writes were made as someone else too.
 */
export function resetUserQueries(client: QueryClient): Promise<void> {
  dropUnsentWrites(client);
  return client.resetQueries({ predicate: isUserQuery });
}

/**
 * For reads a signed-out page shows (a public profile and its sections), by
 * viewer: public while signed out, so opening the page signed out doesn't
 * clear the fetch it's waiting on, and user-scoped when signed in, so what a
 * signed-in viewer could read (their own private profile) is forgotten on
 * sign-out. Put `key` last in the query key so the two never share a cache
 * entry.
 */
export function viewerScoped(userId: string | null | undefined): { key: string; meta: { public: boolean } } {
  return { key: userId ?? 'signed-out', meta: { public: !userId } };
}
