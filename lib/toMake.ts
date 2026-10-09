/**
 * To make: the drinks a home bartender saved for home, against their shelf.
 * Pure helpers (lib/toMake.check.ts); the shelf comes from useMyBar.
 */

/** A group of drinks the same one or two bottles would open (useMyBar's oneAway). */
export interface AwayGroup {
  bottles: readonly { name: string }[];
  drinks: readonly { id: string }[];
}

/** "Ready", "Need Cynar", or nothing when the shelf isn't close to it. */
export function shelfTag(itemId: string | null, canMake: ReadonlySet<string>, oneAway: readonly AwayGroup[]): string | undefined {
  if (!itemId) return undefined;
  if (canMake.has(itemId)) return 'Ready';
  const group = oneAway.find((g) => g.drinks.some((d) => d.id === itemId));
  return group?.bottles.length ? `Need ${group.bottles.map((b) => b.name).join(' and ')}` : undefined;
}

/** Ready ones first, then one bottle away, then the rest; otherwise as saved (newest first). */
export function readyFirst<T>(drinks: readonly T[], tagOf: (d: T) => string | undefined): T[] {
  const rank = (d: T) => {
    const tag = tagOf(d);
    return tag === 'Ready' ? 0 : tag ? 1 : 2;
  };
  return drinks.map((d, i) => ({ d, i, r: rank(d) })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.d);
}
