/**
 * The tab bars, by route name. The venue feature switches are gone (31 Oct
 * 2026): every venue gets the same tabs, and the role changes what a page
 * shows, never the tabs.
 */

/** A venue-mode tab, by its route name. Study's route is still /test. */
export type VenueTab = 'index' | 'library' | 'menus' | 'prep' | 'test' | 'discover';

/** A tab's path, by its route name: index is /. */
export const tabPath = (name: string) => (name === 'index' ? '/' : `/${name}`);

/**
 * The phone tab bars hold four items and Search: Android's bar takes five at
 * most (react-native-screens throws past that), and five labels is as many
 * as a 390-wide pill reads.
 */
export const PHONE_TAB_LIMIT = 4;

/**
 * Home mode's tabs, by route name. Phones show the first three (You opens
 * from the header's avatar); the wide sidebar shows all four.
 */
export const HOME_TAB_NAMES = ['discover', 'bar', 'collection', 'profile'] as const;

/** An item in a phone tab bar, by route name. `new` is the New button. */
export type PhoneTab = VenueTab | (typeof HOME_TAB_NAMES)[number] | 'new';

const VENUE_TABS: readonly VenueTab[] = ['index', 'library', 'menus', 'prep', 'test', 'discover'];

/**
 * Venue mode's tabs: Tonight, Library, Menus, Prep, Study and Discover. Past
 * `limit`, Menus leaves first (Tonight's Menus button and the venue menu
 * still open it), then Study, then Prep.
 * ponytail: the dropped tabs have no other way in on a phone; the new shell
 * (Tonight, Drinks, Discover, You) replaces this list.
 */
export function venueTabs(limit = Infinity): VenueTab[] {
  const tabs = [...VENUE_TABS];
  const drop = ['menus', 'test', 'prep'].slice(0, Math.max(0, tabs.length - limit));
  return tabs.filter((t) => !drop.includes(t));
}

/**
 * A phone tab bar's items, in order, before Search (which is always there).
 * New is a tab (decided 24 Oct 2026) and takes a tab's room so the bar never
 * passes five: at home You steps out (the avatar opens it), at a venue
 * venueTabs drops one more in its usual order.
 */
export function phoneTabs(home: boolean): PhoneTab[] {
  const limit = PHONE_TAB_LIMIT - 1;
  const tabs: PhoneTab[] = home ? HOME_TAB_NAMES.slice(0, limit) : venueTabs(limit);
  return [...tabs, 'new'];
}
