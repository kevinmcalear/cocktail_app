/**
 * What a venue can switch on. A venue's first release is Discover, Library
 * and Menus (decided 13 Oct 2026); everything here is off until the venue's
 * Admin turns it on in Features (bars.enabled_features,
 * supabase/migrations/20261016800000_venue_feature_switches.sql, whose CHECK
 * lists these keys). Home mode doesn't read the switches: it gets `atHome`.
 *
 * Not behind a switch, on purpose: Batch (a sheet on every drink page), the
 * drink page's Service section, and prep cards on ingredient pages.
 *
 * In the order Features lists them (canvas first-round-and-features).
 * `tryIt`: the feature has a sample to try before switching it on
 * (components/bar/TryItSheet.tsx), and about how long that takes.
 */
export const VENUE_FEATURES = [
  { key: 'tonight', label: 'Tonight', detail: 'A Tonight tab for the shift, and This week: events, menus going on, new drinks', atHome: true, tryIt: '1 min' },
  { key: 'backBar', label: 'Back bar', detail: 'A map of where every bottle lives, with labels to print', atHome: true, tryIt: '2 min' },
  { key: 'prep', label: 'Prep', detail: 'A Prep tab with the prep list and orders, and Prep on menus', atHome: false },
  { key: 'study', label: 'Study', detail: 'A Study tab with flash cards for the menu, and a study pile on drinks', atHome: false },
  { key: 'history', label: 'History', detail: 'Every classic’s family tree, in the menu and search', atHome: true },
  { key: 'flavorMap', label: 'Flavor map', detail: 'What goes with what, from search', atHome: true },
  { key: 'techniques', label: 'Techniques', detail: 'Foams, clarifying, infusions and their kit, from search', atHome: true },
  { key: 'libraryExtras', label: 'More library filters', detail: 'R&D, Batched, House-made, Garnishes, Bottles, Cocktails and Needs a price in Library', atHome: true },
  // Simple by default (jam dec-24, 29 Oct 2026): the details most bars don't keep, for the ones that do.
  { key: 'advanced', label: 'Advanced options', detail: 'Wash lines on glasses, with Fit it in the drink editor, and Ice and Tools in setup', atHome: false },
] as const satisfies readonly { key: string; label: string; detail: string; atHome: boolean; tryIt?: string }[];

export type VenueFeatureKey = (typeof VENUE_FEATURES)[number]['key'];

const KEYS = new Set<string>(VENUE_FEATURES.map((f) => f.key));

/** A key this build knows. */
export const isFeatureKey = (k: string): k is VenueFeatureKey => KEYS.has(k);

/**
 * The stored switches, as stored: keys this build doesn't know are kept (a
 * newer app may have added some), so a write from here never drops them.
 * Read a switch with `.includes(key)`; count the known ones with isFeatureKey.
 */
export function parseFeatures(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((k): k is string => typeof k === 'string') : [];
}

type DbError = { code?: string | null } | null | undefined;

/**
 * The database doesn't have bars.enabled_features yet: the app shipped before
 * its migration. Postgres says 42703 on a read, PostgREST PGRST204 on a write.
 */
export function isMissingColumn(error: DbError): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204';
}

/**
 * A venue's switches from its read, never failing: the column not there yet
 * means none (Discover, Library and Menus); any other error (offline, a
 * timeout) keeps what was saved, or none. So a read never throws, never
 * retries, and the tabs never wait on it twice.
 */
export function readFeatures(row: { enabled_features?: unknown } | null | undefined, error: DbError, saved?: string[]): string[] {
  if (isMissingColumn(error)) return [];
  if (error) return saved ?? [];
  return parseFeatures(row?.enabled_features);
}

/** What the Features settings say when a switch didn't save. */
export function featureSaveMessage(error: DbError): string {
  return isMissingColumn(error)
    ? 'Features can’t be switched on yet. They will be after the next update.'
    : 'Couldn’t save that. Check your connection and try again.';
}

/** Switch one feature on or off: the known ones in the catalog's order, then any this build doesn't know, kept. */
export function withFeature(on: readonly string[], key: VenueFeatureKey, enabled: boolean): string[] {
  const known = VENUE_FEATURES.map((f) => f.key).filter((k) => (k === key ? enabled : on.includes(k)));
  return [...known, ...on.filter((k) => !isFeatureKey(k))];
}

/** Who may switch features: Admins (level 40, lib/roles.ts), the only role bars_update lets write them. */
export function canSwitchFeatures(role: number): boolean {
  return role >= 40;
}

/** At home there's no venue to ask: each feature is what home mode always had. */
export function featureAtHome(key: VenueFeatureKey): boolean {
  return VENUE_FEATURES.find((f) => f.key === key)?.atHome ?? false;
}

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

/**
 * A phone tab bar's items, in order, before Search (which is always there).
 * New is a tab (decided 24 Oct 2026) and takes a tab's room so the bar never
 * passes five: at home You steps out (the avatar opens it), at a venue
 * venueTabs drops one more in its usual order.
 */
export function phoneTabs(home: boolean, has: (key: VenueFeatureKey) => boolean): PhoneTab[] {
  const limit = PHONE_TAB_LIMIT - 1;
  const tabs: PhoneTab[] = home ? HOME_TAB_NAMES.slice(0, limit) : venueTabs(has, limit);
  return [...tabs, 'new'];
}
