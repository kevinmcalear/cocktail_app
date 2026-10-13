/**
 * What a venue can switch on. A venue's first release is Discover, Library
 * and Menus (decided 13 Oct 2026); everything here is off until the venue's
 * Admin turns it on in Venue settings (bars.enabled_features,
 * supabase/migrations/20261016800000_venue_feature_switches.sql, whose CHECK
 * lists these keys). Home mode doesn't read the switches: it gets `atHome`.
 *
 * Not behind a switch, on purpose: Batch (a sheet on every drink page), the
 * drink page's Service section, and prep cards on ingredient pages.
 */
export const VENUE_FEATURES = [
  { key: 'tonight', label: 'Tonight', detail: 'A Tonight tab for the shift, and This week: events, menus going on, new drinks', atHome: true },
  { key: 'prep', label: 'Prep', detail: 'A Prep tab with the prep list and orders, and Prep on menus', atHome: false },
  { key: 'study', label: 'Study', detail: 'A Study tab with flash cards for the menu, and a study pile on drinks', atHome: false },
  { key: 'backBar', label: 'Back bar', detail: 'A map of where every bottle lives, with labels to print', atHome: true },
  { key: 'history', label: 'History', detail: 'Every classic’s family tree, in the menu and search', atHome: true },
  { key: 'flavorMap', label: 'Flavor map', detail: 'What goes with what, from search', atHome: true },
  { key: 'techniques', label: 'Techniques', detail: 'Foams, clarifying, infusions and their kit, from search', atHome: true },
] as const satisfies readonly { key: string; label: string; detail: string; atHome: boolean }[];

export type VenueFeatureKey = (typeof VENUE_FEATURES)[number]['key'];

const KEYS = new Set<string>(VENUE_FEATURES.map((f) => f.key));

/** The stored switches, keeping only keys this build knows (a newer app may have added some). */
export function parseFeatures(raw: unknown): VenueFeatureKey[] {
  return Array.isArray(raw) ? raw.filter((k): k is VenueFeatureKey => typeof k === 'string' && KEYS.has(k)) : [];
}

/** Switch one feature on or off, keeping the rest and the catalog's order. */
export function withFeature(on: readonly VenueFeatureKey[], key: VenueFeatureKey, enabled: boolean): VenueFeatureKey[] {
  return VENUE_FEATURES.map((f) => f.key).filter((k) => (k === key ? enabled : on.includes(k)));
}

/** At home there's no venue to ask: each feature is what home mode always had. */
export function featureAtHome(key: VenueFeatureKey): boolean {
  return VENUE_FEATURES.find((f) => f.key === key)?.atHome ?? false;
}

/** A venue-mode tab, by its route name. Study's route is still /test. */
export type VenueTab = 'index' | 'library' | 'menus' | 'prep' | 'test' | 'discover';

/**
 * The phone tab bars hold four tabs and Search: Android's bar takes five at
 * most (react-native-screens throws past that), and five labels is as many
 * as a 390-wide pill reads.
 */
export const PHONE_TAB_LIMIT = 4;

/**
 * Venue mode's tabs: Library, Menus and Discover, with Tonight, Prep and
 * Study when they're on. Past `limit`, Menus leaves first (Tonight's Menus
 * button and the venue menu still open it), then Study, then Prep.
 * ponytail: the dropped tabs have no other way in on a phone. Upgrade path: a
 * "More" place in the venue menu if a venue really wants all six.
 */
export function venueTabs(has: (key: VenueFeatureKey) => boolean, limit = Infinity): VenueTab[] {
  const tabs: VenueTab[] = [];
  if (has('tonight')) tabs.push('index');
  tabs.push('library', 'menus');
  if (has('prep')) tabs.push('prep');
  if (has('study')) tabs.push('test');
  tabs.push('discover');
  const drop: VenueTab[] = tabs.includes('index') ? ['menus', 'test', 'prep'] : ['test', 'prep'];
  for (const name of drop) if (tabs.length > limit && tabs.includes(name)) tabs.splice(tabs.indexOf(name), 1);
  return tabs;
}
