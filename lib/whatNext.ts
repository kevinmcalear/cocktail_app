/**
 * The steps "Set up <bar>" opens in place (lib/setupChecklist.ts): which 20
 * classics to offer, the glasses grouped the way the step lists them, the
 * glasses held until the page is checked, and the brands step's groups.
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

/**
 * Glasses held on the device before the venue's page was checked, as they
 * go onto the page: each catalog glass once (one already there is `skip`),
 * and the first of a type the main one when the page has no main glass of
 * that type yet.
 */
export function heldGlassPlan<T extends { key: string; glass: string; model_id?: string | null }>(
  held: readonly T[],
  onPage: readonly { glass: string; model_id: string | null; is_default: boolean }[]
): { save: (T & { is_default: boolean })[]; skip: string[] } {
  const models = new Set(onPage.map((g) => g.model_id).filter(Boolean));
  const mains = new Set(onPage.filter((g) => g.is_default).map((g) => g.glass));
  const save: (T & { is_default: boolean })[] = [];
  const skip: string[] = [];
  for (const g of held) {
    if (g.model_id && models.has(g.model_id)) {
      skip.push(g.key);
      continue;
    }
    if (g.model_id) models.add(g.model_id);
    save.push({ ...g, is_default: !mains.has(g.glass) });
    mains.add(g.glass);
  }
  return { save, skip };
}

/** Held glasses not on the page yet (a catalog glass saved there already counts once). */
export function heldNotOnPage<T extends { model_id?: string | null }>(held: readonly T[], onPage: readonly { model_id: string | null }[]): T[] {
  return held.filter((h) => !h.model_id || !onPage.some((g) => g.model_id === h.model_id));
}
