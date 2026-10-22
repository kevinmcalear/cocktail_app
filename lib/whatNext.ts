/**
 * "This is your bar. What next?" (board eddie-oct22-wave2, fix 15): the
 * first steps after venue setup. Which 20 classics to offer, the glasses
 * grouped the way the step lists them, and the one-line setup summary.
 */

/** How many classics the menu step offers. */
export const CLASSIC_COUNT = 20;

/**
 * The most ranked classics: most people ranking it first, then the order the
 * catalog already comes in (orderDrinks: best-known, then A to Z), so a young
 * app with few rankings still offers the drinks bars pour most. Missing
 * counts are 0.
 */
export function topClassics<T extends { id: string }>(catalog: readonly T[], rankers: Readonly<Record<string, number>>, n = CLASSIC_COUNT): T[] {
  const at = new Map(catalog.map((c, i) => [c.id, i]));
  return [...catalog].sort((a, b) => (rankers[b.id] ?? 0) - (rankers[a.id] ?? 0) || at.get(a.id)! - at.get(b.id)!).slice(0, n);
}

/** The ticked classics the bar doesn't have a copy of yet: what "Add N classics" adds. */
export function classicsToAdd<T extends { id: string }>(offered: readonly T[], unticked: ReadonlySet<string>, have: ReadonlySet<string>): T[] {
  return offered.filter((c) => !unticked.has(c.id) && !have.has(c.id));
}

/** A bar's drink that is already that classic: a version of it, or the same name. */
export function haveClassics(classics: readonly { id: string; name: string }[], drinks: readonly { name: string; riff_of_id: string | null }[]): Set<string> {
  const fold = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const riffs = new Set(drinks.map((d) => d.riff_of_id).filter(Boolean));
  const names = new Set(drinks.map((d) => fold(d.name)));
  return new Set(classics.filter((c) => riffs.has(c.id) || names.has(fold(c.name))).map((c) => c.id));
}

export interface GlassGroup<T> {
  /** "Cocktail Kingdom · Leopold", or "Libbey" for a shape's list. */
  title: string;
  models: T[];
}

/**
 * Glasses in runs of the same maker (and range, for a search), in the order
 * they came: "Cocktail Kingdom · Leopold · 4" over its four.
 */
export function groupGlasses<T extends { series: string | null; maker: { display_name: string } | null }>(models: readonly T[], by: 'range' | 'maker'): GlassGroup<T>[] {
  const groups: GlassGroup<T>[] = [];
  for (const m of models) {
    const title = [m.maker?.display_name ?? 'Other makers', by === 'range' ? m.series : null].filter(Boolean).join(' · ');
    const last = groups[groups.length - 1];
    if (last?.title === title) last.models.push(m);
    else groups.push({ title, models: [m] });
  }
  return groups;
}

/** "Set up · 3 invites sent · page private until it's checked": wave 1's summary in a line. */
export function setupLine(p: { invites: number; claim: 'none' | 'pending' | 'approved'; waitingFiles: number }): string {
  return [
    'Set up',
    p.invites ? (p.invites === 1 ? 'one invite sent' : `${p.invites} invites sent`) : null,
    p.waitingFiles ? 'spec book being read' : null,
    p.claim === 'pending' ? 'claim being checked' : p.claim === 'none' ? 'page private until it’s checked' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "Cocktail Kingdom, Libbey": who makes the bar's glasses, first seen first. */
export function glassMakers(glasses: readonly { maker: string | null; maker_page: { display_name: string } | null }[], max = 2): string {
  const makers = [...new Set(glasses.map((g) => g.maker_page?.display_name ?? g.maker).filter((m): m is string => !!m))];
  return makers.length > max ? `${makers.slice(0, max).join(', ')} and more` : makers.join(', ');
}
