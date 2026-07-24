/** Sentinel for personal items (bar_id IS NULL). */
export const PERSONAL_CONTEXT = 'personal';

/** Settings default: all contexts, personal only, or a specific bar id. */
export const DEFAULT_SEARCH_ALL = 'all';

/** Resolve persisted default into selectedContextIds once bars are known. */
export function resolveDefaultContextIds(
  defaultSearchContext: string,
  barIds: string[]
): string[] {
  if (defaultSearchContext === DEFAULT_SEARCH_ALL) {
    return [PERSONAL_CONTEXT, ...barIds];
  }
  if (defaultSearchContext === PERSONAL_CONTEXT) {
    return [PERSONAL_CONTEXT];
  }
  if (barIds.includes(defaultSearchContext)) {
    return [defaultSearchContext];
  }
  // ponytail: missing bar → all, same as fresh default
  return [PERSONAL_CONTEXT, ...barIds];
}

/** Client-side: is this bar_id in the selected venue contexts? */
export function inSelectedContext(
  barId: string | null | undefined,
  selectedContextIds: string[]
) {
  if (!barId) return selectedContextIds.includes(PERSONAL_CONTEXT);
  return selectedContextIds.includes(barId);
}

/** Apply multi-context bar filter to a Supabase query builder. */
export function applyBarContextFilter<T extends { is: Function; eq: Function; in: Function; or: Function }>(
  query: T,
  contextIds: string[]
): T {
  const hasPersonal = contextIds.includes(PERSONAL_CONTEXT);
  const barIds = contextIds.filter((id) => id !== PERSONAL_CONTEXT);

  // Empty = treat as personal only (safe default)
  if (contextIds.length === 0) {
    return query.is('bar_id', null) as T;
  }
  if (hasPersonal && barIds.length === 0) {
    return query.is('bar_id', null) as T;
  }
  if (!hasPersonal && barIds.length === 1) {
    return query.eq('bar_id', barIds[0]) as T;
  }
  if (!hasPersonal && barIds.length > 1) {
    return query.in('bar_id', barIds) as T;
  }
  // personal + one or more bars
  return query.or(`bar_id.is.null,bar_id.in.(${barIds.join(',')})`) as T;
}

export function contextLabel(
  contextIds: string[],
  bars: { bar_id: string; name: string }[]
): string {
  const hasPersonal = contextIds.includes(PERSONAL_CONTEXT);
  const barIds = contextIds.filter((id) => id !== PERSONAL_CONTEXT);
  const allBarsSelected = bars.length > 0 && barIds.length === bars.length;

  if (hasPersonal && (bars.length === 0 || allBarsSelected)) {
    return bars.length === 0 ? 'Personal' : 'All';
  }
  if (!hasPersonal && allBarsSelected && bars.length > 0) {
    return bars.length === 1 ? bars[0].name : 'All venues';
  }
  if (hasPersonal && barIds.length === 0) return 'Personal';
  if (!hasPersonal && barIds.length === 1) {
    return bars.find((b) => b.bar_id === barIds[0])?.name || 'Venue';
  }
  if (hasPersonal && barIds.length === 1) {
    const name = bars.find((b) => b.bar_id === barIds[0])?.name || 'Venue';
    return `Personal + ${name}`;
  }
  const n = (hasPersonal ? 1 : 0) + barIds.length;
  return `${n} selected`;
}
