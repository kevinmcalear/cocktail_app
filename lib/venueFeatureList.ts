import { FEATURE_KEYS, SWITCH_KEYS, isMissingColumn, type DbError, type VenueFeatureKey } from './venueFeatures';

/**
 * What the Features screen shows and writes (lib/venueFeatures.ts has what every
 * page reads). Only Features, Kit and bar settings load this file.
 */
const WORDS: Record<VenueFeatureKey, { label: string; detail: string }> = {
  tonight: {
    label: 'Tonight',
    detail: 'A Tonight tab for the shift, and This week: events, menus going on, new drinks',
  },
  backBar: {
    label: 'Back bar',
    detail: 'A map of where every bottle lives, with labels to print',
  },
  prep: {
    label: 'Prep',
    detail: 'The prep list and orders: House-made in the sidebar, Prep on menus',
  },
  study: {
    label: 'Study',
    detail: 'Flash cards for the menu, and a study pile on drinks',
  },
  history: {
    label: 'History',
    detail: 'Every classic’s family tree, from drinks and search',
  },
  flavorMap: {
    label: 'Flavor map',
    detail: 'What goes with what, from search, Learn, ingredients and the drink editor',
  },
  techniques: {
    label: 'Techniques',
    detail: 'Learn: foams, clarifying, infusions and their kit, from search, Tonight and Discover',
  },
  libraryExtras: {
    label: 'More drink filters',
    detail: 'R&D, Batched, House-made, Garnishes, Bottles, Cocktails and Needs a price in Drinks',
  },
  // Simple by default (jam dec-24, 29 Oct 2026): the details most bars don't keep, for the ones that do.
  advanced: {
    label: 'Advanced options',
    detail: 'Wash lines on glasses, with Fit it in the drink editor, and Ice and Tools in setup',
  },
};

/** Every switch with its name and words, in the order Features lists them (FEATURE_KEYS). */
export const VENUE_FEATURES = FEATURE_KEYS.map((key) => ({
  key,
  ...WORDS[key],
}));

/** The switches Features lists. */
export const SWITCHES = VENUE_FEATURES.filter((f) => SWITCH_KEYS.includes(f.key));

/** A key this build knows. */
const isFeatureKey = (k: string): k is VenueFeatureKey => (FEATURE_KEYS as readonly string[]).includes(k);

/** What Features says when a switch didn't save. */
export function featureSaveMessage(error: DbError): string {
  return isMissingColumn(error) ? 'Features can’t be switched on yet. They will be after the next update.' : 'Couldn’t save that. Check your connection and try again.';
}

/** Switch one feature on or off: the known ones in the catalog's order, then any this build doesn't know, kept. */
export function withFeature(on: readonly string[], key: VenueFeatureKey, enabled: boolean): string[] {
  const known = FEATURE_KEYS.filter((k) => (k === key ? enabled : on.includes(k)));
  return [...known, ...on.filter((k) => !isFeatureKey(k))];
}
