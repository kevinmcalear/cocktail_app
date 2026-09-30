import type { Query, QueryClient } from '@tanstack/react-query';

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
 * Drops every user-scoped query's data and refetches the ones on screen.
 * Unlike invalidating, a reset also cancels fetches that started before the
 * session existed, so their anon result can't land and be cached for the
 * query's whole staleTime.
 */
export function resetUserQueries(client: QueryClient): Promise<void> {
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
