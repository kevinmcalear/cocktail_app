/**
 * A drink's family tree: what it's a riff of (up to the root) and who made it
 * where. A bar's drink points at its classic (riff_of_id); a classic points at
 * the classic it came from (lineage_parent_id) or at a historic style
 * (lineage_style_id), and styles point at older styles, back to Punch. Pure helpers, so the ordering and wording can be checked without a
 * database (lib/lineage.check.ts). The queries are in hooks/useLineage.ts.
 */

export type CreditStatus = 'suggested' | 'claimed' | 'verified';

/** A person, a bar, or a maker (the house that makes a bottle, a bar's ice or its glass). */
export type ProfileKind = 'person' | 'bar' | 'maker';

export interface CreditProfile {
  id: string;
  kind: ProfileKind;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  locality: string | null;
  /** Bars only: it has closed, and when. */
  is_closed?: boolean | null;
  closed_year?: number | null;
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
  /** Everyone else who made it (item_co_creators), after the first-named creator. */
  co_creators?: { profile: CreditProfile | null }[] | null;
  /** Catalog classics: the classic it came from, or the style. */
  lineage_parent_id?: string | null;
  lineage_style_id?: string | null;
  /** What changed from its parent, in a line. */
  lineage_note?: string | null;
  /** The year is approximate ("c. 1880"). */
  origin_year_approx?: boolean | null;
  is_catalog?: boolean | null;
}

/** A historic style a classic descends from (Sour, Daisy, Punch). Not a drink. */
export interface DrinkStyle {
  id: string;
  key: string;
  name: string;
  family: string;
  parent_style_id: string | null;
  year: number | null;
  year_approx: boolean;
  summary: string | null;
}

/** The next drink up: a bar's drink to its classic, a classic to the classic it came from. */
export function parentId(drink: Pick<LineageDrink, 'riff_of_id' | 'lineage_parent_id'>): string | null {
  return drink.riff_of_id ?? drink.lineage_parent_id ?? null;
}

/** "1888", "c. 1880", or null. */
export function yearLabel(year: number | null | undefined, approx?: boolean | null): string | null {
  return year ? `${approx ? 'c. ' : ''}${year}` : null;
}

/** A style and the styles above it, oldest first (Punch, Sour, Fizz). Stops on a loop. */
export function styleChain(styleId: string | null | undefined, styles: readonly DrinkStyle[]): DrinkStyle[] {
  const byId = new Map(styles.map((s) => [s.id, s]));
  const chain: DrinkStyle[] = [];
  let next = styleId ? byId.get(styleId) : undefined;
  while (next && !chain.includes(next) && chain.length < MAX_ANCESTORS) {
    chain.push(next);
    next = next.parent_style_id ? byId.get(next.parent_style_id) : undefined;
  }
  return chain.reverse();
}

/** Everyone credited with making the drink, first-named first. */
export function creators(drink: Pick<LineageDrink, 'creator' | 'co_creators'>): CreditProfile[] {
  const all = [drink.creator, ...(drink.co_creators ?? []).map((c) => c.profile)].filter((p): p is CreditProfile => !!p);
  return all.filter((p, i) => all.findIndex((q) => q.id === p.id) === i);
}

/** "Kitty", "Kitty and Darren", "Kitty, Darren and Tom". */
export function joinNames(names: string[]): string {
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** Short enough for a card: "Kitty and Darren", "Kitty and 2 others". The credit sentence names everyone. */
export function shortNames(names: string[]): string {
  return names.length > 2 ? `${names[0]} and ${names.length - 1} others` : joinNames(names);
}

/** Deep enough for any real family (Whisky Sour > Gold Rush > Penicillin > a riff). */
export const MAX_ANCESTORS = 12;

/**
 * Follows parentId upwards and returns the ancestors root first, not
 * including the drink itself. Stops at the root, at a drink the reader can't
 * see (fetch returns null), on a loop, or after MAX_ANCESTORS.
 */
export async function walkAncestors(
  start: Pick<LineageDrink, 'id' | 'riff_of_id' | 'lineage_parent_id'>,
  fetchDrink: (id: string) => Promise<LineageDrink | null>
): Promise<LineageDrink[]> {
  const seen = new Set([start.id]);
  const chain: LineageDrink[] = [];
  let next = parentId(start);
  while (next && !seen.has(next) && chain.length < MAX_ANCESTORS) {
    seen.add(next);
    const parent = await fetchDrink(next);
    if (!parent) break;
    chain.push(parent);
    next = parentId(parent);
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
  const makers = creators(drink);
  makers.forEach((m, i) => {
    const joiner = i === 0 ? (parts.length ? ' by ' : 'By ') : i === makers.length - 1 ? ' and ' : ', ';
    parts.push({ text: joiner }, { text: m.display_name, profileId: m.id });
  });
  if (drink.origin_bar) {
    parts.push({ text: parts.length ? ' at ' : 'At ' }, { text: drink.origin_bar.display_name, profileId: drink.origin_bar.id });
    if (drink.origin_bar.is_closed) parts.push({ text: ' (now closed)' });
  }
  const year = yearLabel(drink.origin_year, drink.origin_year_approx);
  if (year && parts.length) parts.push({ text: `, ${year}` });
  return parts;
}

/** The plain-text form of creditSentence, for accessibility labels. */
export function creditText(parts: CreditPart[]): string {
  return parts.map((p) => p.text).join('');
}

/** Whether a drink has anything for the family tree to show. */
export function hasLineage(drink: LineageDrink | null, ancestors: LineageDrink[], riffs: LineageDrink[], styles: DrinkStyle[] = []): boolean {
  return !!drink && (ancestors.length > 0 || riffs.length > 0 || styles.length > 0 || !!drink.creator || !!drink.origin_bar);
}
