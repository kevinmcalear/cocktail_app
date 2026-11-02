import type { ReactNode } from 'react';

import type { SearchMine } from '@/hooks/useSearchMine';

// Android's open search only (SearchStates.tsx): the web's search draws its own.
export function SearchMore(_: { query: string; mine?: SearchMine; onEverywhere?: () => void }) {
  return null;
}

export function SearchNoMatch(_: { query: string; mine?: SearchMine }) {
  return null;
}

export function SearchLoading() {
  return null;
}

export function drawnGroups(groups: readonly ReactNode[], _barLeads: boolean): ReactNode[] {
  return [...groups];
}
