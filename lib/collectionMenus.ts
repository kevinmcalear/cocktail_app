/**
 * Collection's Menus and Bars, as drawn (home-collection-menus, -bars): your
 * home menus split into coming up, still building and past nights, the date
 * tile and "In 8 days", how much of a menu your shelf makes, a bar's latest
 * news and your average there. Pure helpers (lib/collectionMenus.check.ts).
 */
import { toDay } from '@/lib/collection';
import type { MenuDates } from '@/lib/menuEditions';
import type { AwayGroup } from '@/lib/toMake';

interface Night {
  menuDate: string | null;
  createdAt: string;
}

export interface HomeMenuSplit<T> {
  /** Dated today or later, soonest first: the paper cards. */
  coming: T[];
  /** No night picked yet, newest first. */
  building: T[];
  /** Nights gone by, latest first. */
  past: T[];
}

/** A home menu with a night is a finished menu: coming up, or a past night. Only an undated one is still building. */
export function splitHomeMenus<T extends Night>(menus: readonly T[], now: number): HomeMenuSplit<T> {
  const today = toDay(new Date(now));
  const out: HomeMenuSplit<T> = { coming: [], building: [], past: [] };
  for (const m of menus) out[!m.menuDate ? 'building' : m.menuDate >= today ? 'coming' : 'past'].push(m);
  out.coming.sort((a, b) => a.menuDate!.localeCompare(b.menuDate!));
  out.building.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  out.past.sort((a, b) => b.menuDate!.localeCompare(a.menuDate!));
  return out;
}

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** A day's tile: { mon: 'OCT', day: '17' }. Days are days, not instants: no time zone shift. */
export function dateTile(day: string): { mon: string; day: string } {
  const [, m, d] = day.split('-').map(Number);
  return { mon: MON[m - 1], day: String(d).padStart(2, '0') };
}

/** "Tonight", "Tomorrow", "In 8 days", or null once it's gone. */
export function daysAway(day: string, now: number): string | null {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(now);
  const n = Math.round((new Date(y, m - 1, d).getTime() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) / 86_400_000);
  return n < 0 ? null : n === 0 ? 'Tonight' : n === 1 ? 'Tomorrow' : `In ${n} days`;
}

/** "Saturday · 17 October", the paper card's top line. */
export function nightLong(day: string, locale?: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${date.toLocaleDateString(locale, { weekday: 'long' })} · ${date.toLocaleDateString(locale, { day: 'numeric', month: 'long' })}`;
}

export interface ShelfReady {
  ready: number;
  total: number;
  /** "Need Cynar", "Need 2 bottles", or null when nothing one bottle away. */
  shop: string | null;
}

/** How much of a menu your shelf makes, and what to buy for the rest that's close. */
export function shelfReady(itemIds: readonly string[], canMake: ReadonlySet<string>, oneAway: readonly AwayGroup[]): ShelfReady {
  const ids = [...new Set(itemIds)];
  const need = new Set<string>();
  for (const id of ids) {
    if (canMake.has(id)) continue;
    const group = oneAway.find((g) => g.drinks.some((d) => d.id === id));
    for (const b of group?.bottles ?? []) need.add(b.name);
  }
  const names = [...need];
  const shop = !names.length ? null : names.length === 1 ? `Need ${names[0]}` : `Need ${names.length} bottles`;
  return { ready: ids.filter((id) => canMake.has(id)).length, total: ids.length, shop };
}

/** The mean of your scores, to one decimal; null with none. */
export function averageScore(scores: readonly number[]): number | null {
  if (!scores.length) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

/** "LR" for Little Rye, "K" for Kinsman: a bar's mark when it has no logo. */
export function initials(name: string): string {
  const words = name.replace(/^the\s+/i, '').split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w));
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface BarNews {
  text: string;
  when: string;
}

/**
 * A loved bar's latest news: its newest release, or the menu it's pouring
 * now, whichever started later. A menu only knows its month, so it counts
 * from the 1st.
 */
export function barNews(menu: { name: string; dates: MenuDates } | null, release: { name: string; date: string } | null): BarNews | null {
  const menuDay = menu?.dates.isCurrent ? `${menu.dates.startYear}-${String(menu.dates.startMonth ?? 1).padStart(2, '0')}-01` : null;
  if (release && (!menuDay || release.date >= menuDay)) {
    const [, m, d] = release.date.split('-').map(Number);
    return { text: `New release, ${release.name}`, when: `${d} ${MONTHS[m - 1]}` };
  }
  if (menu && menuDay) {
    const when = menu.dates.startMonth ? `${MONTHS[menu.dates.startMonth - 1]} ${menu.dates.startYear}` : String(menu.dates.startYear);
    return { text: `${menu.name} menu is on`, when };
  }
  return null;
}

// --- Bar menus for you ---

export interface ForYouHad {
  itemId: string;
  name: string;
  score: number;
  /** The bar's profile id. */
  barId: string;
}

export interface ForYouEdition {
  id: string;
  name: string;
  barId: string;
  barName: string;
  dates: MenuDates;
  drinkIds: string[];
}

export interface BarMenuPicks<E extends ForYouEdition> {
  /** The menu on now with the most drinks you had, and the drinks you ranked at that bar. */
  featured: { edition: E; ranked: ForYouHad[] } | null;
  /** Other menus on now at bars you had drinks at, each with why. */
  rail: { edition: E; reason: string }[];
  /** What changed lately at bars you ranked. */
  news: { edition: E; title: string; sub: string }[];
}

/** A bar's place on a ranked list ("No. 3, The World's 50 Best Bars 2026"). */
export interface ListPlace {
  barId: string;
  position: number;
  award: string;
  year: number;
}

/**
 * Bar menus for you before you've ranked anything (canvas E, decided 10 Oct):
 * the menus on now at a ranked list's bars, best placed first, each saying its
 * place. `places` in list order; menus you saved are left out.
 */
export function listMenuPicks<E extends ForYouEdition>(places: readonly ListPlace[], editions: readonly E[], saved: ReadonlySet<string>): { edition: E; reason: string }[] {
  const order = [...places].sort((a, b) => a.position - b.position);
  return order.flatMap((p) => {
    const e = editions.find((x) => x.barId === p.barId && x.dates.isCurrent && !saved.has(x.id));
    return e ? [{ edition: e, reason: `No. ${p.position}, ${p.award} ${p.year}` }] : [];
  });
}

const RECENT_MONTHS = 6;

function monthsAgo(year: number, month: number | null, now: number): number {
  const t = new Date(now);
  return (t.getFullYear() - year) * 12 + (t.getMonth() + 1 - (month ?? 1));
}

/**
 * Picks the Menus tab's "Bar menus for you" from the bars you had drinks at
 * (your rankings), leaving out menus you already saved. `editions` are those
 * bars' menus, newest first.
 */
export function barMenuPicks<E extends ForYouEdition>(had: readonly ForYouHad[], editions: readonly E[], saved: ReadonlySet<string>, now: number): BarMenuPicks<E> {
  const atBar = (barId: string) => had.filter((h) => h.barId === barId).sort((a, b) => b.score - a.score);
  const onNow = editions.filter((e) => e.dates.isCurrent && !saved.has(e.id));
  const hits = (e: E) => e.drinkIds.filter((id) => had.some((h) => h.itemId === id && h.barId === e.barId)).length;
  const ranked = [...onNow].sort((a, b) => hits(b) - hits(a) || atBar(b.barId).length - atBar(a.barId).length);
  const top = ranked.find((e) => atBar(e.barId).length > 0) ?? null;
  const rail = ranked
    .filter((e) => e !== top)
    .flatMap((e) => {
      const best = atBar(e.barId)[0];
      return best ? [{ edition: e, reason: `You had the ${best.name}` }] : [];
    });
  const news: BarMenuPicks<E>['news'] = [];
  const seen = new Set<string>();
  for (const e of editions) {
    if (seen.has(e.barId) || !atBar(e.barId).length) continue;
    seen.add(e.barId);
    const d = e.dates;
    const fromIt = e.drinkIds.filter((id) => had.some((h) => h.itemId === id)).length;
    if (d.isCurrent && monthsAgo(d.startYear, d.startMonth, now) <= RECENT_MONTHS) {
      const since = d.startMonth ? `${MONTHS[d.startMonth - 1]} ${d.startYear}` : String(d.startYear);
      news.push({ edition: e, title: `${e.barName} put out a new menu`, sub: [e.name, since, e.drinkIds.length ? `${e.drinkIds.length} drinks` : null].filter(Boolean).join(' · ') });
    } else if (!d.isCurrent && d.endYear !== null && monthsAgo(d.endYear, d.endMonth, now) <= RECENT_MONTHS) {
      news.push({ edition: e, title: `${e.barName}’s last menu went to the archive`, sub: fromIt ? `You had ${fromIt} ${fromIt === 1 ? 'drink' : 'drinks'} from it · keep them as memories` : e.name });
    }
  }
  return { featured: top ? { edition: top, ranked: atBar(top.barId) } : null, rail: rail.slice(0, 6), news: news.slice(0, 3) };
}
