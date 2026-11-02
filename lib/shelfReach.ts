/**
 * How far a drink is from the home shelf: makeable, one or two bottles off
 * (which), or further. Its own small file so the menu page reads it without
 * Collection's map and Discover helpers (lib/collectionStages.ts uses it too).
 * Checked in lib/collectionStages.check.ts.
 */
import type { AwayGroup } from './toMake';

/** What the shelf says about a drink: makeable, one or two bottles off (which), or further. */
export interface ShelfMatch {
  canMakeIds: ReadonlySet<string>;
  oneAway: readonly AwayGroup[];
  twoAway: readonly AwayGroup[];
}

export type HomeReach = { kind: 'ready' } | { kind: 'one' | 'two'; need: string[] } | { kind: 'far' };

export function homeReach(itemId: string | null, shelf: ShelfMatch): HomeReach {
  if (!itemId) return { kind: 'far' };
  if (shelf.canMakeIds.has(itemId)) return { kind: 'ready' };
  for (const kind of ['one', 'two'] as const) {
    const group = (kind === 'one' ? shelf.oneAway : shelf.twoAway).find((g) => g.drinks.some((d) => d.id === itemId));
    if (group) return { kind, need: group.bottles.map((b) => b.name) };
  }
  return { kind: 'far' };
}

/** "Need Cynar", "Need Campari and pineapple juice". */
export const needLine = (need: readonly string[]) => `Need ${need.join(' and ')}`;

/**
 * The end of a home menu's drink row (menus-one-look, BandMenu): "Ready", or
 * "Need 1" / "Need 2" and which bottles. Nothing when the shelf is further off.
 */
export function menuRowShelf(itemId: string, shelf: ShelfMatch): { label: string; ready: boolean; need: string[] } | null {
  const reach = homeReach(itemId, shelf);
  if (reach.kind === 'ready') return { label: 'Ready', ready: true, need: [] };
  if (reach.kind === 'far' || !reach.need.length) return null;
  return { label: `Need ${reach.need.length}`, ready: false, need: reach.need };
}
