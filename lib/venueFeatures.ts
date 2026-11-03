/**
 * What a venue can switch on, so a section that isn't ready for a bar stays
 * out of its team's way. Off until the venue's Admin turns it on in Features
 * (/settings/bar/<id>/features). Stored in bars.enabled_features
 * (supabase/migrations/20261016800000_venue_feature_switches.sql, whose CHECK
 * lists these keys), except Advanced options, whose home is
 * bars.advanced_options (20261204300000_one_home.sql, hooks/useAdvancedOptions.ts).
 * Home mode doesn't read the switches: it gets `atHome`.
 *
 * Restored 3 Nov 2026 (Kevin), after #1033 took them out.
 * Not behind a switch, on purpose: Drinks, Menus, Discover and You, Batch on
 * every drink page, and prep cards on ingredient pages.
 *
 * In the order Features lists them. lib/venueFeatures.check.ts holds every
 * entry point to its switch.
 */
export const VENUE_FEATURES = [
  { key: 'tonight', label: 'Tonight', detail: 'A Tonight tab for the shift, and This week: events, menus going on, new drinks', atHome: true },
  { key: 'backBar', label: 'Back bar', detail: 'A map of where every bottle lives, with labels to print', atHome: true },
  { key: 'prep', label: 'Prep', detail: 'The prep list and orders: House-made in the sidebar, Prep on menus', atHome: false },
  { key: 'study', label: 'Study', detail: 'Flash cards for the menu, and a study pile on drinks', atHome: false },
  { key: 'history', label: 'History', detail: 'Every classic’s family tree, from drinks and search', atHome: true },
  { key: 'flavorMap', label: 'Flavor map', detail: 'What goes with what, from search, Learn, ingredients and the drink editor', atHome: true },
  { key: 'techniques', label: 'Techniques', detail: 'Learn: foams, clarifying, infusions and their kit, from search, Tonight and Discover', atHome: true },
  { key: 'libraryExtras', label: 'More drink filters', detail: 'R&D, Batched, House-made, Garnishes, Bottles, Cocktails and Needs a price in Drinks', atHome: true },
  // Simple by default (jam dec-24, 29 Oct 2026): the details most bars don't keep, for the ones that do.
  { key: 'advanced', label: 'Advanced options', detail: 'Wash lines on glasses, with Fit it in the drink editor, and Ice and Tools in setup', atHome: false },
] as const satisfies readonly { key: string; label: string; detail: string; atHome: boolean }[];

export type VenueFeatureKey = (typeof VENUE_FEATURES)[number]['key'];

/**
 * Sections every venue has whatever its switches say, which Features doesn't
 * list. Tonight is switchable (Kevin, 3 Nov 2026); to make it a fixed tab
 * again, add 'tonight' here.
 */
export const ALWAYS_ON: readonly VenueFeatureKey[] = [];

/** The switches Features lists. */
export const SWITCHES = VENUE_FEATURES.filter((f) => !ALWAYS_ON.includes(f.key));

const KEYS = new Set<string>(VENUE_FEATURES.map((f) => f.key));

/** A key this build knows. */
export const isFeatureKey = (k: string): k is VenueFeatureKey => KEYS.has(k);

/**
 * The stored switches, as stored: keys this build doesn't know are kept (a
 * newer app may have added some). Read a switch with `.includes(key)`.
 */
export function parseFeatures(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((k): k is string => typeof k === 'string') : [];
}

type DbError = { code?: string | null } | null | undefined;

/** The database doesn't have the column: Postgres says 42703 on a read, PostgREST PGRST204 on a write. */
export function isMissingColumn(error: DbError): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204';
}

/**
 * A venue's switches from its read, never failing: the column not there means
 * none; any other error (offline, a timeout) keeps what was saved, or none. So
 * a read never throws, never retries, and the tabs never wait on it twice.
 */
export function readFeatures(row: { enabled_features?: unknown } | null | undefined, error: DbError, saved?: string[]): string[] {
  if (isMissingColumn(error)) return [];
  if (error) return saved ?? [];
  return parseFeatures(row?.enabled_features);
}

/** What Features says when a switch didn't save. */
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

/**
 * Whether a section shows where you are: at a venue (`on` is its stored list)
 * its switches or ALWAYS_ON; at home (`on` null) `atHome`.
 */
export function featureShown(key: VenueFeatureKey, on: readonly string[] | null): boolean {
  if (on === null) return featureAtHome(key);
  return ALWAYS_ON.includes(key) || on.includes(key);
}

/** Where a deep link to a switched-off section lands: the first tab, Tonight, or Drinks when Tonight is off. */
export function venueHome(has: (key: VenueFeatureKey) => boolean): '/' | '/drinks' {
  return has('tonight') ? '/' : '/drinks';
}
