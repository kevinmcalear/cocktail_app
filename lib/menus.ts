import { dayLabel, parseDay, toDay } from '@/lib/collection';
import type { MenuDetail, MenuDrink, MenuSectionDetail, MenuStatus, MenuSummary } from '@/types/menus';

type Dated = Pick<MenuSummary, 'startsAt' | 'endsAt'> & Partial<Pick<MenuSummary, 'menuDate'>>;

/**
 * Where a menu is in its life. A venue's menu mirrors private.menu_on_now in
 * the database: no dates is a draft, a future start is coming up, a past end
 * is previous. A home menu has a night (menuDate) instead, and with one it's
 * a finished menu: on that day, coming up before it, previous after. Only an
 * undated home menu is still a draft.
 */
export function menuStatus(menu: Dated, now: number): MenuStatus {
  const start = menu.startsAt ? Date.parse(menu.startsAt) : null;
  const end = menu.endsAt ? Date.parse(menu.endsAt) : null;
  if (end !== null && end <= now) return 'previous';
  if (start === null && menu.menuDate) {
    const today = toDay(new Date(now));
    return menu.menuDate > today ? 'upcoming' : menu.menuDate === today ? 'on' : 'previous';
  }
  if (start === null) return 'draft';
  if (start > now) return 'upcoming';
  return 'on';
}

export interface MenuGroups<T> {
  on: T[];
  upcoming: T[];
  draft: T[];
  previous: T[];
  /** R&D collections: never on, filed on their own. */
  rnd: T[];
}

const time = (iso: string | null) => (iso ? Date.parse(iso) : 0);

/**
 * The Menus list: on now (newest first), coming up (soonest first), drafts
 * (newest first), previous (most recently ended first), and R&D collections
 * (by name) apart from all of them.
 */
export function groupMenus<T extends MenuSummary>(menus: T[], now: number): MenuGroups<T> {
  const groups: MenuGroups<T> = { on: [], upcoming: [], draft: [], previous: [], rnd: [] };
  for (const m of menus) groups[m.kind === 'rnd' ? 'rnd' : menuStatus(m, now)].push(m);
  groups.rnd.sort((a, b) => a.name.localeCompare(b.name));
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

/**
 * "since Mon 1 Sep", "starts Fri 3 Oct", "3 Jun to 31 Aug", or null for a
 * draft or a home menu (its night is homeMenuLine). `short`: "since 1 Sep".
 */
export function menuDateLine(menu: Dated, now: number, locale?: string, short = false): string | null {
  // A home menu's night is its date, even once sharing gave it a start.
  if (menu.menuDate || (!menu.startsAt && !menu.endsAt)) return null;
  const status = menuStatus(menu, now);
  if (status === 'on') return `since ${(short ? shortDay : day)(menu.startsAt!, locale)}`;
  if (status === 'upcoming') return `starts ${day(menu.startsAt!, locale)}`;
  if (status === 'previous') {
    return menu.startsAt ? `${shortDay(menu.startsAt, locale)} to ${shortDay(menu.endsAt!, locale)}` : `off since ${shortDay(menu.endsAt!, locale)}`;
  }
  return null;
}

/** The price as the venue typed it, or null when there isn't one. */
/**
 * A cocktail's line on a menu: its ingredients in spec order, each once. A
 * spec that lists an ingredient twice (cream for the drink and for the float)
 * would otherwise read "Heavy Cream, Heavy Cream".
 */
/** An ingredient as the line reads it: plain ones (generic, a prep) in lower case, bottles as named ("gin", "Campari"). */
export function readingName(ing: { name: string; ingredient_role?: string | null } | null | undefined): string | null {
  if (!ing) return null;
  return ing.ingredient_role === 'generic' || ing.ingredient_role === 'prep' ? ing.name.toLowerCase() : ing.name;
}

/** A menu's drink line in sentence case, as the boards draw it: "Gin, dry vermouth, orange bitters". */
export function sentenceLine(line: string): string {
  return line.charAt(0).toUpperCase() + line.slice(1);
}

export function ingredientLine(names: (string | null | undefined)[]): string {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of names) {
    const name = raw?.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    kept.push(name);
  }
  return kept.join(', ');
}

/** A price as typed, trimmed (items.price is text: "19.50" and "MP" stay as they are), or null when blank. */
export function formatPrice(price: string | null | undefined): string | null {
  const p = price?.trim();
  return p ? p : null;
}

/** The price a menu prints for a drink: the menu's own for it, else the drink's. */
export function printedPrice(drink: Pick<MenuDrink, 'price' | 'menuPrice'>): string | null {
  return formatPrice(drink.menuPrice) ?? formatPrice(drink.price);
}

/** "19, or 22 on this menu" when this menu has its own price for the drink; null when it doesn't. */
export function bothPrices(drink: Pick<MenuDrink, 'price' | 'menuPrice'>): string | null {
  const own = formatPrice(drink.price);
  const menu = formatPrice(drink.menuPrice);
  if (!menu) return null;
  return own ? `${own}, or ${menu} on this menu` : `${menu} on this menu only`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** A home menu's night as the person is filling it in. */
export interface NightDraft {
  when: 'none' | 'tonight' | 'tomorrow' | 'date';
  /** Picked, for 'date': 2026-10-04. */
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
  if (draft.when === 'date' && !menuDate) return { error: 'Pick a day.' };
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
      if (!printedPrice(d)) noPrice.push(d.name);
    }
  }
  const hasDrinks = menu.sections.some((s) => s.drinks.length > 0);
  return { short, over, needsPhoto, noPrice, canGoLive: hasDrinks && short.length === 0 && over.length === 0 };
}

/** Drinks on this menu that weren't on any of the others: new for the team to learn (the NEW marker). */
export function newDrinkIds(itemIds: string[], others: { itemIds: string[] }[]): Set<string> {
  const known = new Set(others.flatMap((m) => m.itemIds));
  return new Set(itemIds.filter((id) => !known.has(id)));
}

export function newDrinkCount(itemIds: string[], others: { itemIds: string[] }[]): number {
  return newDrinkIds(itemIds, others).size;
}

/** Tonight's line: "Thu 25 Sep · Autumn menu · 8 drinks", or "Thu 25 Sep · 2 menus on · 12 drinks". */
export function tonightLine(date: Date, menus: { name: string }[], drinks: number, locale?: string): string {
  const day = date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  if (!menus.length) return day;
  return [day, menus.length === 1 ? menus[0].name : `${menus.length} menus on`, plural(drinks, 'drink')].join(' · ');
}

/** "Gin · dry vermouth · orange bitters": a menu line as Tonight's rows read it. */
export function dotLine(line: string): string {
  return line.replace(/\.\s*$/, '').split(/,\s*/).filter(Boolean).join(' · ');
}

/** "Cocktails · 3 to 5", "Beer · up to 3", "Any drink". */
export function sectionRule(section: { allowedTypes: string[]; minItems: number; maxItems: number | null }): string {
  const LABEL: Record<string, string> = { cocktail: 'Cocktails', beer: 'Beer', wine: 'Wine' };
  const kinds = section.allowedTypes.length === 3 ? 'Any drink' : section.allowedTypes.map((t) => LABEL[t] ?? t).join(' & ');
  const { minItems: min, maxItems: max } = section;
  const count = max !== null ? (min > 0 ? `${min} to ${max}` : `up to ${max}`) : min > 1 ? `${min} or more` : null;
  return count ? `${kinds} · ${count}` : kinds;
}

/**
 * A builder section's one line: its rule, how many are in, and what's wrong
 * ("2 to 3 drinks · 1 in · needs one more"). `problem` says to set it in amber.
 */
export function sectionLine(section: { allowedTypes: string[]; minItems: number; maxItems: number | null; drinks: unknown[] }): { text: string; problem: boolean } {
  const { minItems: min, maxItems: max } = section;
  const n = section.drinks.length;
  const any = section.allowedTypes.length === 3;
  const range = max !== null ? (min > 0 ? (min === max ? `${min}` : `${min} to ${max}`) : `up to ${max}`) : min > 1 ? `${min} or more` : null;
  const rule = any ? (range ? `${range} drinks` : 'Any drink') : sectionRule(section);
  const short = min - n;
  const over = max !== null ? n - max : 0;
  const words = ['one', 'two', 'three'];
  const problem = short > 0 ? `needs ${words[short - 1] ?? short} more` : over > 0 ? `${over} too many` : null;
  return { text: [rule, `${n} in`, problem].filter(Boolean).join(' · '), problem: !!problem };
}

/** The menu as plain text, for the share sheet: sections, then each drink with its price and line. */
export function menuAsText(menu: Pick<MenuDetail, 'name' | 'sections'>, venueName?: string | null): string {
  const lines = [venueName ? `${menu.name} at ${venueName}` : menu.name];
  for (const s of menu.sections) {
    if (!s.drinks.length) continue;
    lines.push('', s.name.toUpperCase());
    for (const d of s.drinks) {
      lines.push([d.name, printedPrice(d)].filter(Boolean).join(' '));
      if (d.line) lines.push(`  ${d.line}`);
    }
  }
  return lines.join('\n');
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** A run that is one night: a start and an end a day apart at most. */
export function isOneNightRun(starts: string | null, ends: string | null): boolean {
  if (!starts || !ends) return false;
  const span = Date.parse(ends) - Date.parse(starts);
  return span > 0 && span <= DAY_MS;
}

/** A venue menu that is one night, scheduled or only planned: it can be shared without going live (b15). */
export function isOneNightMenu(menu: Pick<MenuSummary, 'startsAt' | 'endsAt' | 'plannedStartsAt' | 'plannedEndsAt' | 'kind'>): boolean {
  return menu.kind !== 'rnd' && isOneNightRun(menu.startsAt ?? menu.plannedStartsAt, menu.endsAt ?? menu.plannedEndsAt);
}

/** "edited just now", "edited today", "edited yesterday", "edited 3 days ago", "edited 4 Oct". */
export function editedWhen(updatedAt: string, now: number, locale?: string): string {
  const at = new Date(updatedAt);
  const ago = now - at.getTime();
  if (ago < 60 * 60 * 1000) return 'edited just now';
  const days = Math.round((new Date(toDay(new Date(now))).getTime() - new Date(toDay(at)).getTime()) / DAY_MS);
  if (days <= 0) return 'edited today';
  if (days === 1) return 'edited yesterday';
  if (days < 7) return `edited ${days} days ago`;
  return `edited ${at.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`;
}

/** A draft's amber line: what's missing, then when it was edited. "1 section short · edited yesterday". */
export function draftLine(menu: Pick<MenuSummary, 'itemIds' | 'updatedAt'> & { shortSections: number }, now: number, locale?: string): string {
  const missing = menu.shortSections ? `${plural(menu.shortSections, 'section')} short` : menu.itemIds.length ? null : 'No drinks yet';
  return [missing ?? plural(new Set(menu.itemIds).size, 'drink'), editedWhen(menu.updatedAt, now, locale)].join(' · ');
}

/** A coming-up row's caption: the kind, the drinks, the date. "Takeover · 9 drinks · from Fri 3 Oct", "One night · 4 drinks · Fri 31 Oct". */
export function comingUpLine(menu: Pick<MenuSummary, 'startsAt' | 'endsAt' | 'menuDate' | 'itemIds' | 'event' | 'guestCount'>, locale?: string): string {
  const night = isOneNightRun(menu.startsAt, menu.endsAt) || (!menu.startsAt && !!menu.menuDate);
  const start = menu.event?.startsAt ?? menu.startsAt ?? (menu.menuDate ? `${menu.menuDate}T00:00:00` : null);
  const date = start ? day(start, locale) : null;
  return [
    menu.event ? 'Takeover' : night ? 'One night' : null,
    menu.guestCount ? plural(menu.guestCount, 'guest') : null,
    plural(new Set(menu.itemIds).size, 'drink'),
    date ? (night ? date : `from ${date}`) : null,
  ].filter(Boolean).join(' · ');
}

/** A previous menu's line, in mono at the row's end: "3 Jun to 31 Aug · 10". */
export function previousLine(menu: Pick<MenuSummary, 'startsAt' | 'endsAt' | 'itemIds'>, locale?: string): string {
  const dates = menu.endsAt ? (menu.startsAt ? `${shortDay(menu.startsAt, locale)} to ${shortDay(menu.endsAt, locale)}` : `off ${shortDay(menu.endsAt, locale)}`) : null;
  return [dates, String(new Set(menu.itemIds).size)].filter(Boolean).join(' · ');
}

/**
 * When, as the guest card's eyebrow says it: a night ("Friday 31 October"),
 * or a run's start ("From Mon 1 December"), or null for an undated draft.
 */
export function cardWhen(menu: Pick<MenuSummary, 'startsAt' | 'endsAt' | 'menuDate'> & Partial<Pick<MenuSummary, 'plannedStartsAt' | 'plannedEndsAt'>>, locale?: string): string | null {
  const starts = menu.startsAt ?? menu.plannedStartsAt ?? null;
  const ends = menu.startsAt ? menu.endsAt : (menu.plannedEndsAt ?? null);
  // A home menu's date names its night, whenever it was shared (its start).
  const night = menu.menuDate ? `${menu.menuDate}T00:00:00` : starts && isOneNightRun(starts, ends) ? starts : null;
  if (night) return new Date(night).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  return starts ? `From ${new Date(starts).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long' })}` : null;
}

/** A venue draft's planned dates as New menu's third step picks them (b23). */
export interface PlanDraft {
  kind: 'none' | 'run' | 'night';
  /** 2026-10-31 */
  date: string;
  /** 18:00, for a night. */
  time: string;
}

export const EMPTY_PLAN: PlanDraft = { kind: 'none', date: '', time: '18:00' };

/**
 * The plan to save: a run starts at the start of its day; a night starts at
 * its time and ends at 6 the next morning (the service day turning over), so
 * it's always one night. Not live: Go live starts from it.
 */
export function venuePlan(draft: PlanDraft): { plannedStartsAt: string | null; plannedEndsAt: string | null } | { error: string } {
  if (draft.kind === 'none') return { plannedStartsAt: null, plannedEndsAt: null };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return { error: 'Pick a day.' };
  if (draft.kind === 'run') return { plannedStartsAt: new Date(`${draft.date}T00:00:00`).toISOString(), plannedEndsAt: null };
  if (!/^\d{2}:\d{2}$/.test(draft.time)) return { error: 'Pick a time it starts.' };
  const starts = new Date(`${draft.date}T${draft.time}:00`);
  const ends = new Date(`${draft.date}T06:00:00`);
  if (starts.getHours() >= 6) ends.setDate(ends.getDate() + 1);
  return { plannedStartsAt: starts.toISOString(), plannedEndsAt: ends.toISOString() };
}

/** "Friday 31 October, from 6 pm": a one-night menu's night, as the share review says it. */
export function nightLine(startsAt: string, locale?: string): string {
  const d = new Date(startsAt);
  const day = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString(locale, { hour: 'numeric', minute: d.getMinutes() ? '2-digit' : undefined }).replace(/\s?([AP])M$/i, (_, x: string) => ` ${x.toLowerCase()}m`);
  return `${day}, from ${time}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SEASONS = ['Winter', 'Spring', 'Summer', 'Autumn'] as const;
type Season = (typeof SEASONS)[number];

/** The season a day falls in where the venue is: March to May is spring up north and autumn down south. */
export function seasonOf(date: Date, southern: boolean): Season {
  const north = SEASONS[Math.floor(((date.getMonth() + 1) % 12) / 3)];
  return southern ? SEASONS[(SEASONS.indexOf(north) + 2) % 4] : north;
}

// ponytail: the zones of the southern countries most likely to have a venue here. A venue
// with a latitude never gets this far; one with neither is taken to be up north.
const SOUTHERN_ZONES = /^(Australia\/|Antarctica\/|Pacific\/(Auckland|Chatham)|America\/(Argentina|Santiago|Montevideo|Sao_Paulo|Asuncion)|Africa\/(Johannesburg|Maputo|Windhoek))/;

/** Whether a venue is south of the equator: by its latitude, or failing that its time zone. */
export function isSouthern(latitude: number | null | undefined, timeZone: string | null | undefined): boolean {
  if (typeof latitude === 'number') return latitude < 0;
  return SOUTHERN_ZONES.test(timeZone ?? '');
}

/**
 * Names to tap in New menu (nm-decided): the next season after a copied menu's
 * ("Autumn menu" makes "Winter menu"), the season where the venue is on `at`,
 * the month, and the month's own night out where it has one. At most three.
 */
export function menuNameIdeas({ at, southern, copied }: { at: Date; southern: boolean; copied?: string | null }): string[] {
  const ideas: string[] = [];
  const was = SEASONS.find((s) => new RegExp(`\\b${s}\\b`, 'i').test(copied ?? '') || (s === 'Autumn' && /\bfall\b/i.test(copied ?? '')));
  if (was) ideas.push(`${SEASONS[(SEASONS.indexOf(was) + 1) % 4]} menu`);
  ideas.push(`${seasonOf(at, southern)} menu`, MONTHS[at.getMonth()]);
  const special = at.getMonth() === 11 ? 'Holiday menu' : at.getMonth() === 9 ? 'Halloween' : null;
  if (special) ideas.push(special);
  return [...new Set(ideas)].slice(0, 3);
}

/** The next `count` Mondays after today, as days (2026-10-19): New menu's quick picks for when it goes on. */
export function nextMondays(now: number, count = 2): string[] {
  const d = new Date(now);
  d.setDate(d.getDate() + (((8 - d.getDay()) % 7) || 7));
  return Array.from({ length: count }, (_, i) => toDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + i * 7)));
}

/** "Autumn, Summer and 2 more" (a phone's tile: "Autumn, Summer, 2 more"): the saved menus a New menu start names, without "menu". */
export function savedLine(names: string[], phone = false): string {
  const short = [...new Set(names.map((n) => n.replace(/\s+menu$/i, '')))];
  const and = phone ? ', ' : ' and ';
  return short.length > 2 ? `${short[0]}, ${short[1]}${and}${short.length - 2} more` : short.join(and);
}

/** The first `max` drinks, section by section, for a card too small for them all, and how many are left out. */
export function previewSections<S extends { drinks: unknown[] }>(sections: S[], max: number): { sections: S[]; more: number } {
  let room = max;
  const shown = sections.map((s) => {
    const drinks = s.drinks.slice(0, Math.max(room, 0));
    room -= drinks.length;
    return { ...s, drinks };
  });
  const total = sections.reduce((n, s) => n + s.drinks.length, 0);
  return { sections: shown.filter((s) => s.drinks.length), more: total - Math.min(total, max) };
}
