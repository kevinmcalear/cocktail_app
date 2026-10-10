/**
 * How long each kind of query stays fresh and in memory, and which refetch
 * when the app comes back to the foreground (the 8 Oct audit's freshness
 * tiers). lib/react-query.ts registers these with setQueryDefaults; a hook's
 * own option still wins. Checked by lib/queryDefaults.check.ts.
 */

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** In memory unused for this long, then dropped. */
export const GC_TIME = 30 * MINUTE;
/** Saved queries stay in memory as long as the saved cache lasts (persistOptions.maxAge), or the next save drops them. */
export const KEEP = 7 * DAY;

/**
 * The prefix of every lookup list in hooks/useDropdowns.ts (and
 * useCurrentMenuDrinks). Bump it when a shape changes so a saved older list
 * isn't read back.
 */
export const DROPDOWNS_QUERY_KEY = ['dropdowns_v7'] as const;

type Key = readonly string[];
export interface TierOptions {
  staleTime?: number;
  gcTime?: number;
  refetchOnWindowFocus?: boolean;
}

/** Every query unless its tier or hook says otherwise: no refetch on focus. */
export const BASE: Required<TierOptions> = { staleTime: 5 * MINUTE, gcTime: GC_TIME, refetchOnWindowFocus: false };

const D = DROPDOWNS_QUERY_KEY[0];

/** Discover's keys are left to its hooks (hooks/useDiscover*.ts); only the saved ones get KEEP below. */
export const TIERS: Record<'static' | 'catalog' | 'public' | 'user' | 'live', { options: TierOptions; keys: Key[] }> = {
  // Reference lists that change a few times a year: spec lists, classics, the family tree, the flavor atlas.
  static: {
    options: { staleTime: DAY },
    keys: [[D, 'specs'], ['drink-tree'], ['lineage'], ['drink-history'], ['book'], ['pantry-items'], ['ingredient-chain'], ['pairings'], ['pair-drinks'], ['pair-note']],
  },
  // Whole-catalog downloads: too big to refetch on a whim, refreshed by the writes that change them.
  catalog: {
    options: { staleTime: DAY },
    keys: [[D, 'ingredients'], [D, 'ingredient-extras'], ['ingredient-search'], ['bottle-search']],
  },
  // Public pages that change slowly: drinks, profiles, rankings.
  public: {
    options: { staleTime: 10 * MINUTE },
    keys: [
      ['cocktail'], ['beer'], ['wine'], ['ingredient'], ['drink-photos'], ['profile'], ['profile-originals'], ['profile-awards'],
      ['profile-menu-editions'], ['profile-positions'], ['profile-worked-menus'], ['menu-credits'], ['drink-menu-runs'],
      ['bar-profile'], ['drink-rankings'], ['bar-top-drinks'], ['published'],
    ],
  },
  // Yours, or your venue's: refetched on return to the app, since someone else on the team may have changed them.
  user: {
    options: { staleTime: 15 * MINUTE, refetchOnWindowFocus: true },
    keys: [
      ['bars'], ['viewAs'], ['capabilities'], ['venue-brand'], ['age-check'], ['am-i-moderator'], ['profile', 'mine'],
      ['menus-v2'], ['menu'], ['week'], [D, 'menus'], [D, 'current_menu_drinks'], ['collection'], ['home-bar'], ['bar'], ['bar-members'], ['staff-list'],
    ],
  },
  // Shared and changing as you look: drafts, moderation, invites, claims.
  live: {
    options: { staleTime: 30 * SECOND, refetchOnWindowFocus: true },
    keys: [
      ['drafts'], ['report-queue'], ['my-reports'], ['my-open-report'], ['bar-invites'], ['my-invites'], ['profile-claims'],
      ['position-requests'], ['item-comments'], ['item-versions'],
    ],
  },
};

/** Who you are and your venues: an hour, as before. A write refreshes them. */
const HOURLY: Key[] = [['bars'], ['viewAs'], ['venue-brand'], ['age-check'], ['am-i-moderator'], ['profile', 'mine'], ['drink-lists'], ['bar-cities'], ['discover-top-bars']];

/** Saved by `meta: { persist: true }` rather than a PERSISTED_KEYS prefix. */
const META_PERSISTED: Key[] = [[D, 'specs'], [D, 'current_menu_drinks'], ['discover-list'], ['discover-bars'], ['discover-tile']];

/**
 * Each prefix's options, merged across tiers, shorter prefixes first:
 * TanStack applies every matching prefix in the order set, so ['profile',
 * 'mine'] (yours) overrides ['profile'] (anyone's).
 */
export function queryDefaults(persisted: readonly Key[]): { queryKey: Key; options: TierOptions }[] {
  const merged = new Map<string, { queryKey: Key; options: TierOptions }>();
  const add = (queryKey: Key, options: TierOptions) => {
    const id = JSON.stringify(queryKey);
    merged.set(id, { queryKey, options: { ...merged.get(id)?.options, ...options } });
  };
  for (const tier of Object.values(TIERS)) for (const key of tier.keys) add(key, tier.options);
  for (const key of HOURLY) add(key, { staleTime: HOUR });
  for (const key of [...persisted, ...META_PERSISTED]) add(key, { gcTime: KEEP });
  return [...merged.values()].sort((a, b) => a.queryKey.length - b.queryKey.length);
}
