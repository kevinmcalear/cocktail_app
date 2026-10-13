// The words My Bar puts on its tiles, rows and cards, as the canvas draws
// them (home-mybar-*.dc.html). Pure, so lib/myBarText.check.ts can hold them.

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Under "My Bar": "7 drinks ready · 2 preps you can make now". */
export function barSubtitle(ready: number, preps: number): string {
  const parts = [ready ? `${plural(ready, 'drink')} ready` : 'Nothing ready yet'];
  if (preps) parts.push(`${plural(preps, 'prep')} you can make now`);
  return parts.join(' · ');
}

/** The desktop header's line: "4 bottles · 6 in the fridge · 2 on the lab shelf · 2 house preps · 3 pieces of kit". */
export function shelfCountsLine(c: { bottles: number; fridge: number; lab: number; preps: number; kit: number }): string {
  return [
    c.bottles ? plural(c.bottles, 'bottle') : null,
    c.fridge ? `${c.fridge} in the fridge` : null,
    c.lab ? `${c.lab} on the lab shelf` : null,
    c.preps ? plural(c.preps, 'house prep') : null,
    c.kit ? plural(c.kit, 'piece of kit', 'pieces of kit') : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** How long something keeps, in words: "a day", "3 days", "about a week", "2 weeks", "3 months". */
export function keepsFor(hours: number): string {
  const days = hours / 24;
  if (days < 1.5) return hours < 20 ? plural(Math.max(1, Math.round(hours)), 'hour') : 'a day';
  if (days < 6) return plural(Math.round(days), 'day');
  if (days < 10) return 'about a week';
  if (days < 56) return plural(Math.round(days / 7), 'week');
  if (days < 330) return plural(Math.round(days / 30), 'month');
  return days < 540 ? 'a year' : 'for years';
}

const shortDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/**
 * A house prep tile's second half, after "Made 3 Oct": "keeps 2 weeks" while
 * it's fresh, "use by 17 Oct" in its last three days (`soon`), "past its use-by"
 * after. Null when nobody says how long it keeps.
 */
export function prepUseBy(madeAt: string | null | undefined, keepsHours: number | null | undefined, now = new Date()): { text: string; soon: boolean } | null {
  if (!madeAt || !keepsHours) return null;
  const made = new Date(madeAt);
  if (Number.isNaN(made.getTime())) return null;
  const by = new Date(made.getTime() + keepsHours * 3_600_000);
  const left = (by.getTime() - now.getTime()) / 86_400_000;
  if (left < 0) return { text: 'past its use-by', soon: true };
  if (left <= 3) return { text: `use by ${shortDate(by)}`, soon: true };
  return { text: `keeps ${keepsFor(keepsHours)}`, soon: false };
}

/** A prep card's meta: "Overnight · keeps about a week". Either half may be missing. */
export function prepMeta(time: string | null | undefined, keepsHours: number | null | undefined): string | null {
  const parts = [time || null, keepsHours ? `keeps ${keepsFor(keepsHours)}` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** A shelf name as it reads in a sentence: a plain ingredient in lower case ("lemon"), a bottle as named ("Woodford Reserve"). */
export function inSentence(name: string, generic: boolean): string {
  return generic ? name.toLowerCase() : name;
}

/**
 * What of yours a drink uses, one short name per thing, as the canvas ticks
 * them ("Woodford, lemon, sugar"): a bottle stands in for the kind it is (your
 * Cocchi, not also "sweet vermouth"), and "lemon" for "lemon juice".
 */
export function tickNames(items: readonly { name: string; generic: boolean; kind?: string | null }[]): string[] {
  const kinds = new Set(items.filter((i) => !i.generic && i.kind).map((i) => i.kind!.toLowerCase()));
  const kept = items.filter((i) => !(i.generic && kinds.has(i.name.toLowerCase())));
  const lower = kept.map((i) => i.name.toLowerCase());
  return kept.filter((_, n) => !lower.some((o, m) => m !== n && lower[n].startsWith(`${o} `))).map((i) => inSentence(i.name, i.generic));
}

/** Under a drink one or two bottles away: "Uses your Woodford, Campari", or "Nothing else needed". */
export function usesLine(names: readonly string[]): string {
  return names.length ? `Uses your ${names.join(', ')}` : 'Nothing else needed';
}

/**
 * A bottle group's line: "Opens 6 drinks · uses your Campari, Fernet", or
 * "· with your pantry" when only staples go in. `bottles`: the bottles of yours its drinks use.
 */
export function groupLine(drinks: number, bottles: readonly string[], max = 2): string {
  const opens = `Opens ${plural(drinks, 'drink')}`;
  if (!bottles.length) return `${opens} · with your pantry`;
  const named = bottles.slice(0, max);
  const more = bottles.length - named.length;
  return `${opens} · uses your ${named.join(', ')}${more > 0 ? ` +${more}` : ''}`;
}

/** Two bottles to buy, as a pair: "Gin and Sweet Vermouth". */
export function pairName(names: readonly string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : (names[0] ?? '');
}

/** What a two-away drink needs, in a search: "Needs rye and absinthe". */
export function needsLine(names: readonly string[]): string {
  return `Needs ${pairName(names.map((n) => n.toLowerCase()))}`;
}

/** A drink's caption source: a bar's version names the bar, a catalog drink is a Classic, with where it's served. */
export function sourceCaption(from: string | null | undefined, served: string | null | undefined): string {
  if (from) return from;
  return served ? `Classic · ${served.charAt(0).toLowerCase()}${served.slice(1)}` : 'Classic';
}

/** What to make's line under the tabs, per tab (null where the board draws none). */
export function tabIntro(tab: 'ready' | 'first' | 'one' | 'two' | 'projects'): string | null {
  if (tab === 'one') return 'Grouped by what to buy, the bottle that opens the most first.';
  if (tab === 'two') return 'Two bottles to buy, grouped as a pair. The pair that opens the most first.';
  return null;
}

/** The line above Search every drink: Ready says what's listed; the away tabs that it's all there is. */
export function footLine(tab: 'ready' | 'first' | 'one' | 'two' | 'projects'): string {
  const rule = 'Only drinks with a full spec you can follow.';
  return tab === 'one' || tab === 'two' ? `That’s everything your shelf gets close to. ${rule}` : rule;
}

/** A finished bottle's history line: "Bought 2 Mar", and how long it lasted: "5 mo". */
export function lastedLine(boughtAt: string | null, finishedAt: string): { bought: string | null; lasted: string | null } {
  const end = new Date(finishedAt);
  if (!boughtAt) return { bought: null, lasted: null };
  const start = new Date(boughtAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { bought: null, lasted: null };
  const sameYear = start.getFullYear() === end.getFullYear();
  const bought = `Bought ${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })}`;
  // Calendar days between the two dates, so a daylight-saving hour or the machine's time zone never tips a rounding.
  const days = Math.max(0, Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86_400_000));
  const lasted = days < 14 ? plural(Math.max(1, days), 'day') : days < 60 ? `${Math.round(days / 7)} wk` : `${Math.round(days / 30.44)} mo`;
  return { bought, lasted };
}

const SECTION_WORD = { bottles: 'Bottle', fridge: 'Fridge & pantry', lab: 'Lab shelf', preps: 'House-made' } as const;

/**
 * An add-sheet result's line: what it's a kind of and where it's from
 * ("Liqueur · Italy"), "House-made" for a prep, else the section it goes in.
 */
export function foundLine(item: { section: keyof typeof SECTION_WORD; kind?: string | null; origin?: string | null }): string {
  if (item.section === 'preps') return SECTION_WORD.preps;
  const country = item.origin?.split(',').pop()?.trim() || null;
  const parts = [item.kind || null, country].filter(Boolean);
  return parts.length ? parts.join(' · ') : SECTION_WORD[item.section];
}
