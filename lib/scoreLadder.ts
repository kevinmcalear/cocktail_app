import { MIN_RANKERS } from './ranking';

/**
 * The published score ladder (Loop-ladder, How scores work): each rung and
 * when a score shows there. Only the people floor (MIN_RANKERS, 20) is set;
 * the 50 ranks for a bar's drinks together and the 5 bars for city and
 * postcode lists are the canvas's placeholders until Kevin sets them (Kevin
 * queue). One home for the words, so every page that shows them agrees.
 */
export const SCORE_LADDER = [
  { name: 'You and friends', when: 'At once, from your first rank.' },
  { name: 'A bar’s drinks together', when: 'After a few weeks, once 50 ranks are in.' },
  { name: 'Its signature drinks', when: `Within a season, once ${MIN_RANKERS} people rank one drink.` },
  { name: 'City lists', when: 'Once 5 bars in the city pass that floor.' },
  { name: 'Postcode lists', when: 'Last, once 5 bars in the postcode pass it.' },
] as const;
