import { MIN_RANKERS } from './ranking';

/**
 * The score ladder's floors, one config for the app (Loop-ladder, Red-score,
 * Loop-reasons, Kept-score). The database has the same numbers in
 * private.score_floor (20261206210000_score_recency.sql); scoreLadder.check.ts
 * keeps the two in step.
 *
 * Only people (20, MIN_RANKERS) is set. barRanks (50 ranks for a bar's drinks
 * together) and listBars (5 bars for a city or postcode list) are the canvas's
 * placeholders until Kevin sets them (Kevin queue). reasons and room are the
 * 20 people the boards draw before guests' words show.
 */
export const FLOORS = {
  people: MIN_RANKERS,
  barRanks: 50,
  listBars: 5,
  reasons: 20,
  room: 20,
} as const;

/**
 * The published score ladder (Loop-ladder, How scores work): each rung and
 * when a score shows there. One home for the words, so every page that shows
 * them agrees.
 */
export const SCORE_LADDER = [
  { name: 'You and friends', when: 'At once, from your first rank.' },
  { name: 'A bar’s drinks together', when: `After a few weeks, once ${FLOORS.barRanks} ranks are in.` },
  { name: 'Its signature drinks', when: `Within a season, once ${FLOORS.people} people rank one drink.` },
  { name: 'City lists', when: `Once ${FLOORS.listBars} bars in the city pass that floor.` },
  { name: 'Postcode lists', when: `Last, once ${FLOORS.listBars} bars in the postcode pass it.` },
] as const;

/** Ranks count in full for this many days after the drink was had, then half (private.score_weight). */
export const FULL_WEIGHT_DAYS = 180;
