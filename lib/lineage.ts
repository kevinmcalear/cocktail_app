/**
 * A drink's family tree: what it's a riff of (up to the root) and who made it
 * where. A bar's drink points at its classic (riff_of_id); a classic points at
 * the classic it came from (lineage_parent_id) or at a historic style
 * (lineage_style_id), and styles point at older styles, back to Punch. Pure helpers, so the ordering and wording can be checked without a
 * database (lib/lineage.check.ts). The queries are in hooks/useLineage.ts.
 */

export type CreditStatus = 'suggested' | 'claimed' | 'verified';

/** A co-creator's answer: named and waiting for their yes, said yes, or said Not me. */
export type CoCreatorStatus = 'pending' | 'accepted' | 'declined';

/** A person, a bar, or a maker (the house that makes a bottle, a bar's ice or its glass). */
export type ProfileKind = 'person' | 'bar' | 'maker' | 'supplier';

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
  /**
   * Everyone else who made it (item_co_creators), after the first-named
   * creator. Waiting and declined ones come back only to the person named,
   * the drink's editors and moderators; only accepted ones are in the credit.
   */
  co_creators?: { status?: CoCreatorStatus; profile: CreditProfile | null }[] | null;
  /** Makers with no page, by name ("Harry Craddock"): items.creator_names. Credited after the makers with a page, with no link. */
  creator_names?: string[] | null;
  /** Catalog classics: the classic it came from, or the style. */
  lineage_parent_id?: string | null;
  lineage_style_id?: string | null;
  /** What changed from its parent, in a line. */
  lineage_note?: string | null;
  /** The year is approximate ("c. 1880"). */
  origin_year_approx?: boolean | null;
  /** The year is our best guess inside a range: 'decade', 'early', 'mid' or 'late' (items.origin_year_guess). */
  origin_year_guess?: string | null;
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

/** "1888", "c. 1880", "mid 1930s (best guess)", or null. */
export function yearLabel(year: number | null | undefined, approx?: boolean | null, guess?: string | null): string | null {
  if (!year) return null;
  return guess ? `${guessRange(year, guess)} (best guess)` : `${approx ? 'c. ' : ''}${year}`;
}

/** The range a best-guess year sits in: "1920s", "mid 1930s". */
export function guessRange(year: number, guess: string): string {
  const decade = `${Math.floor(year / 10) * 10}s`;
  return guess === 'decade' ? decade : `${guess} ${decade}`;
}

/** A year in a sentence: "1888", "about 1880", "mid 1930s (best guess)". */
export function yearPhrase(year: number, approx?: boolean | null, guess?: string | null): string {
  return guess ? (yearLabel(year, approx, guess) ?? '') : `${approx ? 'about ' : ''}${year}`;
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

/** Everyone credited with making the drink, first-named first: co-creators only once they said yes. */
export function creators(drink: Pick<LineageDrink, 'creator' | 'co_creators'>): CreditProfile[] {
  const yes = (drink.co_creators ?? []).filter((c) => (c.status ?? 'accepted') === 'accepted');
  const all = [drink.creator, ...yes.map((c) => c.profile)].filter((p): p is CreditProfile => !!p);
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

/** What a bar's drink is to the classic it names (public.spec_matches). */
export type SpecVerdict = 'same' | 'unlisted' | 'variation' | 'riff';

/** A drink's name as the database compares it (private.drink_name_key): "The Americano" and "americano" are one name. */
// No import, so the share-image function (api/drink-og.ts, via lib/publicDrink) stays free of the '@/' alias.
export const drinkNameKey = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^(the|classic|house|le|el|la) /, '');

/**
 * Is this drink a riff on its parent, or a bar's own version of it (jam
 * dec-21, dec-22, Eddie tf-086)? A bar pouring its Americano at 35/35 instead
 * of 40/40 is still the Americano. It's a riff only when the spec really
 * changes into another drink: the spec verdict says riff, or, with no
 * verdict (a parent outside the catalog, or before it loads), the name is
 * neither the parent's nor one of its other names (public.classic_aliases:
 * "Gin and Tonic" is the Gin & Tonic), as the verdict itself reads it.
 */
export function isRiff(drink: Pick<LineageDrink, 'name'>, parent: { name: string; aliases?: readonly string[] | null }, verdict?: SpecVerdict | null): boolean {
  if (verdict) return verdict === 'riff';
  const key = drinkNameKey(drink.name);
  return ![parent.name, ...(parent.aliases ?? [])].some((n) => drinkNameKey(n) === key);
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
  const makers: CreditPart[] = [...creators(drink).map((m) => ({ text: m.display_name, profileId: m.id })), ...(drink.creator_names ?? []).map((text) => ({ text }))];
  makers.forEach((m, i) => {
    const joiner = i === 0 ? (parts.length ? ' by ' : 'By ') : i === makers.length - 1 ? ' and ' : ', ';
    parts.push({ text: joiner }, m);
  });
  if (drink.origin_bar) {
    parts.push({ text: parts.length ? ' at ' : 'At ' }, { text: drink.origin_bar.display_name, profileId: drink.origin_bar.id });
    if (drink.origin_bar.is_closed) parts.push({ text: ' (now closed)' });
  }
  const year = yearLabel(drink.origin_year, drink.origin_year_approx, drink.origin_year_guess);
  if (year && parts.length) parts.push({ text: `, ${year}` });
  return parts;
}

/**
 * The credit as it reads under a drink's name on its page (boards
 * drink-phone-venue, -home, -classic): "Created by Sam Ross at Milk & Honey,
 * New York, 2005", "Riff of Naked and Famous at Little Rye, Brunswick", or for
 * a classic nobody is credited with, "Classic, about 1916 · at Detroit
 * Athletic Club". A bar's own version of a classic reads "Americano by Little
 * Rye, Brunswick" (isRiff). The bar's place always follows its name. The status word
 * ("· Verified") is the caller's.
 */
export function nameCredit(drink: LineageDrink, parent: Pick<LineageDrink, 'id' | 'name'> | null, verdict?: SpecVerdict | null): CreditPart[] {
  const bar = drink.origin_bar;
  const withPlace = (parts: CreditPart[]) =>
    parts.flatMap((p) => (bar?.locality && p.profileId === bar.id && !bar.is_closed ? [p, { text: `, ${bar.locality}` }] : [p]));
  if (drink.is_catalog && !creators(drink).length && !drink.creator_names?.length) {
    const year = drink.origin_year ? `, ${yearPhrase(drink.origin_year, drink.origin_year_approx, drink.origin_year_guess)}` : '';
    const parts: CreditPart[] = [{ text: `Classic${year}` }];
    if (bar) parts.push({ text: ' · at ' }, { text: bar.display_name, profileId: bar.id }, ...(bar.is_closed ? [{ text: ' (now closed)' }] : []));
    return withPlace(parts);
  }
  // A bar's own version of a classic (dec-21): "Americano by Little Rye", the classic's name a link to it and its history.
  if (parent && !drink.is_catalog && !isRiff(drink, parent, verdict)) {
    const by = withPlace(creditSentence(drink, null));
    const link = { text: parent.name, drinkId: parent.id };
    if (!by.length) return [{ text: 'A version of the ' }, link];
    return [link, { text: ' by ' }, ...by.slice(1)];
  }
  // A classic's parent is in its family row; the line under the name is who made it.
  const parts = creditSentence(drink, drink.is_catalog ? null : parent);
  if (parts[0]?.text === 'By ') parts[0] = { text: 'Created by ' };
  else if (parts[0]?.text === 'At ' && drink.is_catalog) parts[0] = { text: 'Created at ' };
  return withPlace(parts);
}

/** The plain-text form of creditSentence, for accessibility labels. */
export function creditText(parts: CreditPart[]): string {
  return parts.map((p) => p.text).join('');
}

/** Whether a drink has anything for the family tree to show. */
export function hasLineage(drink: LineageDrink | null, ancestors: LineageDrink[], riffs: LineageDrink[], styles: DrinkStyle[] = []): boolean {
  return !!drink && (ancestors.length > 0 || riffs.length > 0 || styles.length > 0 || !!drink.creator || !!drink.origin_bar);
}
