import { dayLabel, parseDay, toDay } from '@/lib/collection';
import type { MenuDetail, MenuSectionDetail, MenuStatus, MenuSummary } from '@/types/menus';

type Dated = Pick<MenuSummary, 'startsAt' | 'endsAt'>;

/**
 * Where a menu is in its life. Mirrors private.menu_on_now in the database:
 * no dates is a draft, a future start is coming up, a past end is previous.
 */
export function menuStatus(menu: Dated, now: number): MenuStatus {
  const start = menu.startsAt ? Date.parse(menu.startsAt) : null;
  const end = menu.endsAt ? Date.parse(menu.endsAt) : null;
  if (end !== null && end <= now) return 'previous';
  if (start === null) return 'draft';
  if (start > now) return 'upcoming';
  return 'on';
}

export interface MenuGroups<T> {
  on: T[];
  upcoming: T[];
  draft: T[];
  previous: T[];
}

const time = (iso: string | null) => (iso ? Date.parse(iso) : 0);

/**
 * The Menus list: on now (newest first), coming up (soonest first), drafts
 * (newest first), previous (most recently ended first).
 */
export function groupMenus<T extends MenuSummary>(menus: T[], now: number): MenuGroups<T> {
  const groups: MenuGroups<T> = { on: [], upcoming: [], draft: [], previous: [] };
  for (const m of menus) groups[menuStatus(m, now)].push(m);
  groups.on.sort((a, b) => time(b.startsAt) - time(a.startsAt));
  groups.upcoming.sort((a, b) => time(a.startsAt) - time(b.startsAt));
  groups.draft.sort((a, b) => time(b.createdAt) - time(a.createdAt));
  groups.previous.sort((a, b) => time(b.endsAt) - time(a.endsAt));
  return groups;
}

function day(iso: string, locale?: string): string {
  return new Date(iso).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
}

function shortDay(iso: string, locale?: string): string {
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

/** "since Mon 1 Sep", "starts Fri 3 Oct", "3 Jun to 31 Aug", or null for a draft. */
export function menuDateLine(menu: Dated, now: number, locale?: string): string | null {
  const status = menuStatus(menu, now);
  if (status === 'on') return `since ${day(menu.startsAt!, locale)}`;
  if (status === 'upcoming') return `starts ${day(menu.startsAt!, locale)}`;
  if (status === 'previous') {
    return menu.startsAt ? `${shortDay(menu.startsAt, locale)} to ${shortDay(menu.endsAt!, locale)}` : `off since ${shortDay(menu.endsAt!, locale)}`;
  }
  return null;
}

/** The price as the venue typed it, or null when there isn't one. */
export function formatPrice(price: string | null | undefined): string | null {
  const p = price?.trim();
  return p ? p : null;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** A home menu's night as the person is filling it in. */
export interface NightDraft {
  when: 'none' | 'tonight' | 'tomorrow' | 'date';
  /** Typed, for 'date': 2026-10-04. */
  date: string;
  /** Typed: blank for not saying. */
  guests: string;
}

/** The date and guest count to save, or what to fix (menus.guest_count is 1 to 500). */
export function homeNight(draft: NightDraft, now: number): { menuDate: string | null; guestCount: number | null } | { error: string } {
  const today = new Date(now);
  const menuDate =
    draft.when === 'none'
      ? null
      : draft.when === 'date'
        ? parseDay(draft.date)
        : toDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + (draft.when === 'tomorrow' ? 1 : 0)));
  if (draft.when === 'date' && !menuDate) return { error: 'Use a date like 2026-10-04.' };
  const typed = draft.guests.trim();
  const guestCount = typed ? Number(typed) : null;
  if (guestCount !== null && (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 500)) return { error: 'Guests: a number from 1 to 500.' };
  return { menuDate, guestCount };
}

/** A home menu's night: "Sat 4 Oct · 6 guests", either part alone, or null. */
export function homeMenuLine(menu: { menuDate: string | null; guestCount: number | null }, now: number, locale?: string): string | null {
  const parts = [menu.menuDate ? dayLabel(menu.menuDate, now, locale) : null, menu.guestCount ? plural(menu.guestCount, 'guest') : null];
  return parts.filter(Boolean).join(' · ') || null;
}

export interface Readiness {
  /** Sections under their minimum, with how many more they need. */
  short: { name: string; needed: number }[];
  /** Sections over their maximum, with how many too many. */
  over: { name: string; extra: number }[];
  /** Drinks that show a drawn sketch (or nothing) until someone takes a photo. */
  needsPhoto: string[];
  noPrice: string[];
  /** Nothing that stops it going on: every section within its limits. */
  canGoLive: boolean;
}

/** What to fix, or know, before a menu goes on. */
export function menuReadiness(menu: { sections: Pick<MenuSectionDetail, 'name' | 'minItems' | 'maxItems' | 'drinks'>[] }): Readiness {
  const short: Readiness['short'] = [];
  const over: Readiness['over'] = [];
  const needsPhoto: string[] = [];
  const noPrice: string[] = [];
  for (const s of menu.sections) {
    if (s.drinks.length < s.minItems) short.push({ name: s.name, needed: s.minItems - s.drinks.length });
    if (s.maxItems !== null && s.drinks.length > s.maxItems) over.push({ name: s.name, extra: s.drinks.length - s.maxItems });
    for (const d of s.drinks) {
      if (!d.imageUrl || d.isSketch) needsPhoto.push(d.name);
      if (!formatPrice(d.price)) noPrice.push(d.name);
    }
  }
  const hasDrinks = menu.sections.some((s) => s.drinks.length > 0);
  return { short, over, needsPhoto, noPrice, canGoLive: hasDrinks && short.length === 0 && over.length === 0 };
}

/** Drinks on this menu that weren't on any of the others: new for the team to learn. */
export function newDrinkCount(itemIds: string[], others: { itemIds: string[] }[]): number {
  const known = new Set(others.flatMap((m) => m.itemIds));
  return new Set(itemIds.filter((id) => !known.has(id))).size;
}

/** "Cocktails · 3 to 5", "Beer · up to 3", "Any drink". */
export function sectionRule(section: { allowedTypes: string[]; minItems: number; maxItems: number | null }): string {
  const LABEL: Record<string, string> = { cocktail: 'Cocktails', beer: 'Beer', wine: 'Wine' };
  const kinds = section.allowedTypes.length === 3 ? 'Any drink' : section.allowedTypes.map((t) => LABEL[t] ?? t).join(' & ');
  const { minItems: min, maxItems: max } = section;
  const count = max !== null ? (min > 0 ? `${min} to ${max}` : `up to ${max}`) : min > 1 ? `${min} or more` : null;
  return count ? `${kinds} · ${count}` : kinds;
}

/** The menu as plain text, for the share sheet: sections, then each drink with its price and line. */
export function menuAsText(menu: Pick<MenuDetail, 'name' | 'sections'>, venueName?: string | null): string {
  const lines = [venueName ? `${menu.name} at ${venueName}` : menu.name];
  for (const s of menu.sections) {
    if (!s.drinks.length) continue;
    lines.push('', s.name.toUpperCase());
    for (const d of s.drinks) {
      lines.push([d.name, formatPrice(d.price)].filter(Boolean).join(' '));
      if (d.line) lines.push(`  ${d.line}`);
    }
  }
  return lines.join('\n');
}
