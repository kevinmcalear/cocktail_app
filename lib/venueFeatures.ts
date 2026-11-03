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
 * This file is what every page loads, so it stays small: the Features
 * screen's names, words and writes live in lib/venueFeatureList.ts.
 * lib/venueFeatures.check.ts holds every entry point to its switch.
 */
/** Each switch, and whether home mode has the section (home doesn't read switches). In the order Features lists them. */
export const AT_HOME = {
  tonight: true,
  backBar: true,
  prep: false,
  study: false,
  history: true,
  flavorMap: true,
  techniques: true,
  libraryExtras: true,
  advanced: false,
} as const;

export type VenueFeatureKey = keyof typeof AT_HOME;

/** Every key, in the order Features lists them. */
export const FEATURE_KEYS = Object.keys(AT_HOME) as VenueFeatureKey[];

/**
 * Sections every venue has whatever its switches say, which Features doesn't
 * list. Tonight is switchable (Kevin, 3 Nov 2026); to make it a fixed tab
 * again, add 'tonight' here.
 */
export const ALWAYS_ON: readonly VenueFeatureKey[] = [];

/** The keys Features lists a switch for. */
export const SWITCH_KEYS = FEATURE_KEYS.filter((k) => !ALWAYS_ON.includes(k));

/** Who may switch features: Admins (level 40, lib/roles.ts), the only role bars_update lets write them. */
export function canSwitchFeatures(role: number): boolean {
  return role >= 40;
}

/**
 * The stored switches, as stored: keys this build doesn't know are kept (a
 * newer app may have added some). Read a switch with `.includes(key)`.
 */
export function parseFeatures(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((k): k is string => typeof k === 'string') : [];
}

export type DbError = { code?: string | null } | null | undefined;

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

/**
 * Whether a section shows where you are: at a venue (`on` is its stored list)
 * its switches or ALWAYS_ON; at home (`on` null) `atHome`.
 */
export function featureShown(key: VenueFeatureKey, on: readonly string[] | null): boolean {
  if (on === null) return AT_HOME[key];
  return ALWAYS_ON.includes(key) || on.includes(key);
}

/** Where a deep link to a switched-off section lands: the first tab, Tonight, or Drinks when Tonight is off. */
export function venueHome(has: (key: VenueFeatureKey) => boolean): '/' | '/drinks' {
  return has('tonight') ? '/' : '/drinks';
}
