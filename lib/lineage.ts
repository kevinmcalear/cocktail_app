/**
 * A drink's family tree: what it's a riff of (up to the root) and who made it
 * where. Pure helpers, so the ordering and wording can be checked without a
 * database (lib/lineage.check.ts). The queries are in hooks/useLineage.ts.
 */

export type CreditStatus = 'suggested' | 'claimed' | 'verified';

export interface CreditProfile {
  id: string;
  kind: 'person' | 'bar';
  handle: string;
  display_name: string;
  avatar_url: string | null;
  locality: string | null;
}

export interface LineageDrink {
  id: string;
  name: string;
  riff_of_id: string | null;
  origin_year: number | null;
  credit_status: CreditStatus | null;
  /** The legacy label: Classic, Original, Variant. */
  origin: string | null;
  creator: CreditProfile | null;
  origin_bar: CreditProfile | null;
}

/** Deep enough for any real family (Whisky Sour > Gold Rush > Penicillin > a riff). */
export const MAX_ANCESTORS = 8;

/**
 * Follows riff_of_id upwards and returns the ancestors root first, not
 * including the drink itself. Stops at the root, at a drink the reader can't
 * see (fetch returns null), on a loop, or after MAX_ANCESTORS.
 */
export async function walkAncestors(
  start: Pick<LineageDrink, 'id' | 'riff_of_id'>,
  fetchDrink: (id: string) => Promise<LineageDrink | null>
): Promise<LineageDrink[]> {
  const seen = new Set([start.id]);
  const chain: LineageDrink[] = [];
  let next = start.riff_of_id;
  while (next && !seen.has(next) && chain.length < MAX_ANCESTORS) {
    seen.add(next);
    const parent = await fetchDrink(next);
    if (!parent) break;
    chain.push(parent);
    next = parent.riff_of_id;
  }
  return chain.reverse();
}

const STATUS_RANK: Record<CreditStatus, number> = { verified: 0, claimed: 1, suggested: 2 };

/**
 * Riffs, best-credited first, then by name.
 * ponytail: order by ranking score once 7c's get_item_scores lands.
 */
export function sortRiffs<T extends Pick<LineageDrink, 'name' | 'credit_status'>>(riffs: T[]): T[] {
  const rank = (d: T) => (d.credit_status ? STATUS_RANK[d.credit_status] : 3);
  return [...riffs].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** Credit status in words, so it never relies on colour alone. */
export function creditLabel(status: CreditStatus | null): string | null {
  if (status === 'verified') return 'Verified';
  if (status === 'claimed') return 'Claimed';
  if (status === 'suggested') return 'Suggested';
  return null;
}

/** What each status means, for screen readers and the claim flow. */
export function creditHint(status: CreditStatus | null): string | null {
  if (status === 'verified') return 'Checked by a moderator.';
  if (status === 'claimed') return 'Confirmed by the creator or their bar, not yet checked by a moderator.';
  if (status === 'suggested') return 'Added by someone else and not yet confirmed.';
  return null;
}

/** One piece of a credit sentence; profile and drink pieces become links. */
export type CreditPart = { text: string; profileId?: string; drinkId?: string };

/**
 * "Riff of Gold Rush by Sam Ross at Milk & Honey, 2005", as parts, leaving
 * out whatever isn't known. Empty when there's nothing to say.
 */
export function creditSentence(drink: LineageDrink, parent: Pick<LineageDrink, 'id' | 'name'> | null): CreditPart[] {
  const parts: CreditPart[] = [];
  if (parent) parts.push({ text: 'Riff of ' }, { text: parent.name, drinkId: parent.id });
  if (drink.creator) {
    parts.push({ text: parts.length ? ' by ' : 'By ' }, { text: drink.creator.display_name, profileId: drink.creator.id });
  }
  if (drink.origin_bar) {
    parts.push({ text: parts.length ? ' at ' : 'At ' }, { text: drink.origin_bar.display_name, profileId: drink.origin_bar.id });
  }
  if (drink.origin_year && parts.length) parts.push({ text: `, ${drink.origin_year}` });
  return parts;
}

/** The plain-text form of creditSentence, for accessibility labels. */
export function creditText(parts: CreditPart[]): string {
  return parts.map((p) => p.text).join('');
}

/** Whether a drink has anything for the family tree to show. */
export function hasLineage(drink: LineageDrink | null, ancestors: LineageDrink[], riffs: LineageDrink[]): boolean {
  return !!drink && (ancestors.length > 0 || riffs.length > 0 || !!drink.creator || !!drink.origin_bar);
}
