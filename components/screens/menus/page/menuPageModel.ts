// What a menu page shows, from the menu, where it is in its life and who is
// looking (2027 canvas, Menu-page): kept pure so the screen only wires taps.
import type { MenuLensData } from '@/hooks/useMenuLens';
import { menuRowShelf, type ShelfMatch } from '@/lib/shelfReach';
import { allergenChips, allergensTonight, allergyLine, isMenuTeam, isStaffLens, rowStateMark } from '@/lib/menuLens';
import { homeMenuLine, menuDateLine, plural, printedPrice } from '@/lib/menus';
import type { MenuDetail, MenuStatus } from '@/types/menus';

import type { MenuInk } from './MenuDrawing';
import type { PageRowView } from './MenuPageRow';

/** What a group row does when tapped; the screen maps each to its handler. */
export type GroupAction = 'dates' | 'costing' | 'runSheet' | 'barPage' | 'end' | 'prep' | 'offMenu' | 'publish' | 'shopping' | 'night' | 'replaces' | null;

export interface ModelGroupRow {
  label: string;
  value: string;
  warn?: boolean;
  action: GroupAction;
}

export interface MenuPageModel {
  ink: MenuInk;
  quiet: boolean;
  tag: { label: string; tone: 'green' | 'amber' | 'quiet' } | null;
  eyebrow: string;
  group: ModelGroupRow[];
  banner: { text: string; aside: string | null; warn: boolean; toNow: boolean } | null;
  sections: { id: string; name: string; rows: PageRowView[] }[];
  /** A quiet line after the drinks. */
  after: string | null;
}

interface Input {
  menu: MenuDetail;
  status: MenuStatus;
  lens: MenuLensData;
  venueName: string | null;
  /** The bar's menu on now, for a draft's Replaces and a past menu's On now marks. */
  onNow: { name: string; endsAt: string | null; itemIds: Set<string> } | null;
  /** Drinks new on this menu (no ended menu had them). */
  newIds: ReadonlySet<string> | undefined;
  shelf: ShelfMatch | null;
  /** How many things a home menu still needs bought; null until the shelf is read. */
  toBuy: number | null;
  day: (iso: string) => string;
  now: number;
  /** Drinks off for tonight only (the floor and guests read "Not tonight"; the team's live list draws its own). */
  offTonight?: ReadonlySet<string>;
}

/**
 * The group block holds only the rows the board draws for the person looking; the rest go into the More sheet
 * (opened from On), never under the drinks: an Admin's Run sheet (Menu-who-admin draws On, Costing, bar page,
 * End), and on a living list (Menu-l-*, which draws On, Last change, Team, Costing) the run sheet and End. An Admin's
 * bar page row stays on the page either way: Menu-who-admin draws it under Costing (board note: the Creator's page plus
 * On the bar page and End this menu).
 */
export function splitGroup(rows: ModelGroupRow[], living: boolean, admin: boolean): [top: ModelGroupRow[], more: ModelGroupRow[]] {
  const off = (r: ModelGroupRow) => (r.action === 'runSheet' ? admin || living : living && r.action === 'end');
  return [rows.filter((r) => !off(r)), rows.filter(off)];
}

/** Those rows as More's buttons. End is More's own Take it off now; the bar page row says what tapping it does. */
export function moreExtras(rows: ModelGroupRow[], menu: Pick<MenuDetail, 'hiddenAt'>, actions: Record<Exclude<GroupAction, null>, () => void>): { label: string; onPress: () => void }[] {
  return rows
    .filter((r) => r.action && r.action !== 'end')
    .map((r) => ({ label: r.action === 'barPage' ? (menu.hiddenAt ? 'Show on the bar page' : 'Hide from the bar page') : r.label, onPress: actions[r.action!] }));
}

/** On the bar page, Shown or Hidden: tapping it flips the menu's hidden_at. */
const barPageRow = (menu: MenuDetail): ModelGroupRow => ({ label: 'On the bar page', value: menu.hiddenAt ? 'Hidden' : 'Shown', action: 'barPage' });

/** "Autumn, on 30 Nov": the menu a draft replaces, to the last day it's on (its end, or the day before the draft goes on). */
function replacesLine(onNow: { name: string; endsAt: string | null }, goesOn: string | null, day: (iso: string) => string): string {
  const last = onNow.endsAt ?? (goesOn ? new Date(Date.parse(goesOn) - 86_400_000).toISOString() : null);
  return last ? `${onNow.name}, on ${day(last)}` : onNow.name;
}

export function menuPageModel({ menu, status, lens: L, venueName, onNow, newIds, shelf, toBuy, day, now, offTonight }: Input): MenuPageModel {
  const { lens } = L;
  // An undated home menu is an idea, not a draft: it isn't published, so it's never pencil.
  const draft = status === 'draft' && !!menu.barId;
  const past = status === 'previous';
  const home = lens === 'home' || !menu.barId;
  const team = isMenuTeam(lens);
  const drinks = menu.sections.flatMap((s) => s.drinks);
  const ink: MenuInk = draft ? 'pencil' : past ? 'faded' : 'colour';
  const dates = menuDateLine(menu, now, undefined, true);

  // --- tag and eyebrow ---
  let tag: MenuPageModel['tag'] = null;
  let eyebrow = [venueName, status === 'on' ? 'On now' : null, dates].filter(Boolean).join(' · ');
  if (home) eyebrow = [lens === 'home' ? 'Your menu' : null, homeMenuLine(menu, now)].filter(Boolean).join(' · ') || 'A night in';
  if (draft) {
    tag = { label: 'Draft', tone: 'amber' };
    eyebrow = [venueName, menu.plannedStartsAt ? `Planned for ${day(menu.plannedStartsAt)}` : 'No date yet'].filter(Boolean).join(' · ');
  } else if (past) {
    tag = { label: 'Past menu', tone: 'quiet' };
    eyebrow = [venueName, dates].filter(Boolean).join(' · ');
  } else if (status === 'upcoming' && !home) {
    tag = { label: 'Coming up', tone: 'quiet' };
    eyebrow = [venueName, dates].filter(Boolean).join(' · ');
  } else if (status === 'on' && isStaffLens(lens)) {
    tag = { label: 'On now', tone: 'green' };
    eyebrow = [venueName, dates].filter(Boolean).join(' · ');
  }

  // --- the group block ---
  const noPrice = drinks.filter((d) => d.kind === 'cocktail' && !printedPrice(d));
  let group: ModelGroupRow[] = [];
  if (draft && !home) {
    group = [
      { label: 'Goes on', value: menu.plannedStartsAt ? day(menu.plannedStartsAt) : 'Add a date', action: 'publish' },
      ...(onNow ? [{ label: 'Replaces', value: replacesLine(onNow, menu.plannedStartsAt, day), action: 'replaces' as const }] : []),
      ...(noPrice.length ? [{ label: 'Unfinished', value: `${plural(noPrice.length, 'drink')} ${noPrice.length === 1 ? 'has' : 'have'} no price`, warn: true, action: null }] : []),
    ];
  } else if (home && lens === 'home') {
    group = [
      { label: 'Shopping list', value: toBuy === null ? 'What to buy' : toBuy ? `${plural(toBuy, 'thing')} to buy` : 'Nothing to buy', warn: !!toBuy, action: 'shopping' },
      { label: 'Who’s coming', value: menu.guestCount ? plural(menu.guestCount, 'person', 'people') : 'Add a date and guests', action: 'night' },
    ];
  } else if (lens === 'employee') {
    const counts = new Map<string, number>();
    for (const labels of L.allergens.values()) for (const a of labels) counts.set(a, (counts.get(a) ?? 0) + 1);
    const fresh = drinks.filter((d) => newIds?.has(d.id)).map((d) => d.name);
    group = [
      { label: 'Allergens tonight', value: allergensTonight(counts, L.allergens.size, new Set(drinks.map((d) => d.id)).size), action: null },
      ...(fresh.length ? [{ label: 'New this menu', value: fresh.join(', '), action: null }] : []),
    ];
  } else if (lens === 'bartender' && !past) {
    group = [
      ...(L.prep ? [{ label: 'House-made for this menu', value: 'Prep list', action: 'prep' as const }] : []),
      { label: 'Off the menu', value: 'What else we make', action: 'offMenu' },
    ];
  } else if (team && !past) {
    const on = status === 'on' ? [dates ?? 'on now', menu.endsAt ? `ends ${day(menu.endsAt)}` : 'no end date'].join(' · ') : (dates ?? 'No date');
    group = [
      { label: 'On', value: on, action: 'dates' },
      ...(L.costs ? [{ label: 'Costing', value: L.averageCost ? `average ${L.averageCost}` : 'Not costed yet', action: 'costing' as const }] : []),
      ...(lens === 'creator' || lens === 'admin' ? [{ label: 'Run sheet', value: '', action: 'runSheet' as const }] : []),
      // Hiding is for a menu that ran (menus_hidden_ran); a list still to come is unscheduled instead.
      ...(lens === 'admin' ? [...(status === 'on' && menu.startsAt ? [barPageRow(menu)] : []), { label: 'End this menu', value: '', action: 'end' as const }] : []),
    ];
  } else if (lens === 'admin' && past && menu.startsAt) {
    group = [barPageRow(menu)];
  }

  // --- the banner ---
  let banner: MenuPageModel['banner'] = null;
  const mineHits = drinks.filter((d) => L.mine.has(d.id));
  if (lens === 'guest' && !past && mineHits.length) {
    const labels = [...new Set(mineHits.flatMap((d) => L.mine.get(d.id)!))];
    banner = { text: allergyLine(labels, mineHits.length)!, aside: mineHits.length === 1 ? mineHits[0].name : null, warn: true, toNow: false };
  }
  if (past && !isStaffLens(lens)) banner = { text: 'This menu has ended', aside: onNow ? 'What’s on now ›' : null, warn: false, toNow: !!onNow };

  // --- rows ---
  const stateOf = new Map(L.rows.map((r) => [`${r.sectionId}:${r.itemId}`, r]));
  const sections = menu.sections.map((s) => ({
    id: s.id,
    name: s.name,
    rows: s.drinks.map((d): PageRowView => {
      const notes = L.notes[d.id];
      let end: string | null = printedPrice(d);
      let endTone: PageRowView['endTone'] = 'ink';
      let flag: PageRowView['flag'] = null;
      if (lens === 'guest' && L.mine.has(d.id)) flag = { label: L.mine.get(d.id)!.join(', '), tone: 'amber' };
      if (draft && d.kind === 'cocktail' && !end) {
        end = 'No price';
        endTone = 'amber';
      }
      if (past) {
        if (!isStaffLens(lens)) end = null;
        if (onNow?.itemIds.has(d.id)) flag = { label: 'On now', tone: 'green' };
      }
      if (home) {
        end = null;
        const reach = lens === 'home' && shelf ? menuRowShelf(d.id, shelf) : null;
        if (reach) {
          end = reach.ready ? 'Ready' : `Need ${reach.need.join(', ').toLowerCase()}`;
          endTone = reach.ready ? 'green' : 'amber';
        }
      }
      const row = team ? stateOf.get(`${s.id}:${d.id}`) : undefined;
      const mark = row ? rowStateMark(row.state, row.onFrom, row.offAt, day) : null;
      if (mark) flag = { label: mark, tone: row!.state.startsWith('waiting') ? 'amber' : 'quiet' };
      const notTonight = !team && !past && !!offTonight?.has(d.id);
      if (notTonight) flag = { label: 'Not tonight', tone: 'quiet' };
      return {
        drink: d,
        line: lens === 'bartender' && notes?.method ? notes.method : d.line,
        end,
        endTone,
        sub: team ? (L.cost.get(d.id) ?? null) : null,
        flag,
        chips: lens === 'employee' ? allergenChips(L.allergens.get(d.id), L.allergens.size > 0) : null,
        talkingPoint: lens === 'employee' ? (notes?.talkingPoint ?? null) : null,
        ink,
        faded: notTonight || undefined,
      };
    }),
  }));

  const after = past ? (isStaffLens(lens) ? null : 'Prices are left off past menus, so nobody orders from one. Staff still see them.') : null;
  return { ink, quiet: draft || past, tag, eyebrow, group, banner, sections, after };
}
