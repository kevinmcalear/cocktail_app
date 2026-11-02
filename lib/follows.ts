/**
 * Words for following people (Kept-follow, Kept-people): the Follow button's
 * label, when a rank happened ("tonight", "Tuesday"), the Friends and Lately
 * lines, and a person's favourite family. Pure, so lib/follows.check.ts
 * checks them without a database.
 */

/** What the Follow button says: you already follow them, they follow you, or neither. */
export function followLabel(s: { following: boolean; followsYou: boolean }): 'Following' | 'Follow back' | 'Follow' {
  if (s.following) return 'Following';
  return s.followsYou ? 'Follow back' : 'Follow';
}

const DAY_MS = 24 * 60 * 60 * 1000;
const dayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * When a rank happened, as a word after a dot: "tonight" the same night (from
 * 5pm, and till 6am like the rota's nights), "today" earlier that day,
 * "yesterday", the weekday within the week, then the date ("12 Oct").
 */
export function rankWhen(at: string, now: Date, locale?: string): string {
  const then = night(new Date(at));
  const days = nightsAgo(at, now);
  const hour = new Date(at).getHours();
  if (days <= 0) return hour >= 17 || hour < 6 ? 'tonight' : 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return then.toLocaleDateString(locale, { weekday: 'long' });
  return then.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/** A night runs till 6am: a 1:30am rank belongs to the evening before. */
const night = (d: Date) => new Date(d.getTime() - 6 * 60 * 60 * 1000);
const nightsAgo = (at: string, now: Date) => Math.round((dayOf(night(now)) - dayOf(night(new Date(at)))) / DAY_MS);

/** Within the last seven nights, the ones rankWhen names by weekday: "Ranked a Penicillin tonight" on People, else their line. */
export const isThisWeek = (at: string, now: Date) => nightsAgo(at, now) < 7;

/** "a Penicillin", "an Old Fashioned". */
export const withArticle = (name: string) => `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;

/** "Sam’s best sour": now their top drink of its family. */
export const bestLine = (first: string, family: string) => `${first}’s best ${family.toLowerCase()}`;

/** A family as many: "Sours", "Old Fashioneds", "Fizzes"; Tiki stays Tiki. */
export function familyPlural(family: string): string {
  if (/tiki$/i.test(family) || /s$/i.test(family)) return family;
  if (/(x|z|ch|sh)$/i.test(family)) return `${family}es`;
  return `${family}s`;
}

/** Capitalise a line that now starts with a lower-case word ("Now Jules’s best sour"). */
const lead = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Parts of a row's line joined with dots, starting with a capital. */
export const dotLine = (parts: readonly (string | null | undefined | false)[]) => lead(parts.filter(Boolean).join(' · '));

/**
 * A friend's rank on Tonight (Kept-follow): "Sam ranked a Penicillin", under
 * it the bar, then either "now Sam’s best sour" or when it was.
 */
export function friendRankLines(
  r: { displayName: string; name: string; venueName: string | null; createdAt: string; drinkFamily: string | null; bestInFamily: boolean },
  now: Date,
  locale?: string,
): { title: string; sub: string } {
  const first = r.displayName.split(' ')[0] || r.displayName;
  const tail = r.bestInFamily && r.drinkFamily ? `now ${bestLine(first, r.drinkFamily)}` : rankWhen(r.createdAt, now, locale);
  return { title: `${first} ranked ${withArticle(r.name)}`, sub: dotLine([r.venueName, tail]) };
}

/**
 * Their favourite family from the drinks they show: the family most of their
 * ranks belong to, once at least two do. Null when nothing leads.
 */
export function favouriteFamily(families: readonly (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>();
  for (const f of families) if (f) counts.set(f, (counts.get(f) ?? 0) + 1);
  const sorted = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [top, next] = sorted;
  if (!top || top[1] < 2 || (next && next[1] === top[1])) return null;
  return top[0];
}

/** "Sam, Ana and 12 more" (You's Following row): the first two names, then the count. */
export function namesLine(names: readonly string[], total: number): string | null {
  const firsts = names.slice(0, 2).map((n) => n.split(' ')[0] || n);
  if (!firsts.length) return null;
  const more = total - firsts.length;
  if (more <= 0) return firsts.length === 2 ? `${firsts[0]} and ${firsts[1]}` : firsts[0];
  return `${firsts.join(', ')} and ${more} more`;
}
