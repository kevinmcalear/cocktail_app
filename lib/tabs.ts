/**
 * The four tabs: Tonight, Drinks, Discover and You, the same for every person
 * and role (tabs A, decided 31 Oct 2026). The mode changes what a tab shows,
 * never which tabs there are. Search sits beside them (the circle on iOS and
 * phone-width web, the top search bar on Android, ⌘K on wide web).
 */

export type TabName = 'tonight' | 'drinks' | 'discover' | 'you';

export interface Tab {
  name: TabName;
  label: string;
  /** Its root page: Tonight is /. */
  path: '/' | '/drinks' | '/discover' | '/you';
  /**
   * The tab's route group under app/(tabs), which holds its own stack. Numbered
   * in tab order: a cold link to a page every tab shares (a drink) opens in the
   * first group by name, so Tonight's must sort first.
   */
  route: `(${number}-${TabName})`;
}

export const TABS: readonly Tab[] = [
  { name: 'tonight', label: 'Tonight', path: '/', route: '(1-tonight)' },
  { name: 'drinks', label: 'Drinks', path: '/drinks', route: '(2-drinks)' },
  { name: 'discover', label: 'Discover', path: '/discover', route: '(3-discover)' },
  { name: 'you', label: 'You', path: '/you', route: '(4-you)' },
];

/** The tab a route group belongs to ('(2-drinks)' to 'drinks'), or null for search and pages outside the tabs. */
export function tabOfGroup(group: string | undefined): TabName | null {
  return TABS.find((t) => t.route === group)?.name ?? null;
}
