import type { VenueFeatureKey } from '@/lib/venueFeatures';

/**
 * The four tabs: Tonight, Drinks, Discover and You (tabs A, decided 31 Oct
 * 2026). The mode changes what a tab shows; the one tab that can leave is
 * Tonight, at a venue that hasn't switched it on (lib/venueFeatures.ts), and
 * then the app opens on Drinks. Search sits beside them (the circle on iOS and
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

/** The tabs shown where you are: all four, or three when Tonight is switched off (hooks/useVenueFeatures.ts `has`). */
export function shownTabs(has: (key: VenueFeatureKey) => boolean): readonly Tab[] {
  return has('tonight') ? TABS : TABS.filter((t) => t.name !== 'tonight');
}

/** "Search your drinks" opens search on your drinks, whatever the tab would start on. */
export const YOUR_DRINKS = 'Search your drinks';

/** What a phone's search field says before you type (search2). */
export const SEARCH_ANYTHING = 'Search or add anything';

/** What a search from Discover looks through: Android's bar there, and the field on the page. */
export const DISCOVER_SEARCH = 'Search bars, drinks, bottles';

/** What Android's search bar says on each page (Prod-and): what search starts on from there. */
export function searchBarLabel(segments: readonly string[]): string {
  if (segments.includes('(3-discover)')) return DISCOVER_SEARCH;
  if (segments.includes('(2-drinks)')) return YOUR_DRINKS;
  return SEARCH_ANYTHING;
}

/** The tab a route group belongs to ('(2-drinks)' to 'drinks'), or null for search and pages outside the tabs. */
export function tabOfGroup(group: string | undefined): TabName | null {
  return TABS.find((t) => t.route === group)?.name ?? null;
}

/** The route name of each tab's first page, and of the search page, as a stack names them. */
const PAGE_WORDS: Record<string, string> = { index: 'Tonight', drinks: 'Drinks', discover: 'Discover', you: 'You', search: 'Search' };

/**
 * What Back says on the wide web (desktop boards: "Back says where it goes"):
 * the page under this one, from its stack title. A title is the page's own name
 * (a drink, Prep); a tab's first page has only its route name. Anything else
 * still a route path, or nothing under it at all, just says Back.
 */
export function backWord(title: string | undefined): string {
  if (!title || title.includes('/') || title.includes('[')) return 'Back';
  // An untitled page has only its route name ('prep'): say it as a word.
  return PAGE_WORDS[title] ?? title[0].toUpperCase() + title.slice(1);
}

/**
 * Android shows its nav bar on top-level screens only (Material; And-who-guest-hit,
 * Miss-made): a tab's first page. A pushed page (a drink, an ingredient, Prep) and
 * search hide it. `segments` is useSegments(): ['(tabs)', '(2-drinks)', 'drinks'].
 */
export function androidBarShown(segments: readonly string[]): boolean {
  return segments[0] === '(tabs)' && [undefined, 'drinks', 'discover', 'you'].includes(segments[2]);
}
