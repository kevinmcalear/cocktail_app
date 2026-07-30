import { inSelectedContext } from '@/lib/barContextFilter';
import { RecentActivity, RecentKind, useRecentActivityStore } from '@/store/useRecentActivityStore';
import { useEffect } from 'react';

const DRAFT_ROUTE: Partial<Record<RecentKind, string>> = {
  cocktail: '/add-cocktail',
  beer: '/add-beer',
  wine: '/add-wine',
  ingredient: '/add-ingredient',
};

/** Push one recent entry when the entity becomes available. */
export function useTrackRecent(
  ready: boolean,
  entry: Omit<RecentActivity, 'at'> | null
) {
  const push = useRecentActivityStore((s) => s.push);

  useEffect(() => {
    if (!ready || !entry) return;
    push(entry);
    // ponytail: track by identity only — title/image churn shouldn't spam the ring
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, entry?.kind, entry?.id, entry?.isDraft]);
}

export function recentEntry(
  kind: RecentKind,
  id: string,
  title: string,
  opts?: {
    subtitle?: string;
    href?: string;
    imageUrl?: string | null;
    barId?: string | null;
    isDraft?: boolean;
  }
): Omit<RecentActivity, 'at'> {
  const draftRoute = opts?.isDraft ? DRAFT_ROUTE[kind] : undefined;
  const href =
    opts?.href ||
    (opts?.isDraft && kind === 'menu'
      ? `/edit-mode?type=menu_draft&id=${encodeURIComponent(id)}`
      : draftRoute
        ? `${draftRoute}?draftId=${id}`
        : kind === 'menu'
          ? '/(tabs)/menus'
          : kind === 'quiz'
            ? '/(tabs)/test'
            : `/${kind}/${kind === 'beer' || kind === 'wine' ? `${kind}-${id}` : id}`);
  return {
    id,
    kind,
    title,
    subtitle: opts?.subtitle ?? (opts?.isDraft ? 'Draft' : kind.charAt(0).toUpperCase() + kind.slice(1)),
    href,
    imageUrl: opts?.imageUrl,
    barId: opts?.barId,
    isDraft: opts?.isDraft,
  };
}

/** Hide venue-bound recents that aren't in the current context filter. */
export function recentMatchesContext(
  r: Pick<RecentActivity, 'kind' | 'barId'>,
  selectedContextIds: string[]
) {
  if (r.kind === 'quiz') return true;
  // ponytail: legacy entries pre-barId stay visible until re-visited
  if (r.barId === undefined) return true;
  return inSelectedContext(r.barId, selectedContextIds);
}
