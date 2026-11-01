// What a menu page shows, from the menu, where it is in its life and who is
// looking (2027 canvas, Menu-page): kept pure so the screen only wires taps.
import type { MenuLensData } from '@/hooks/useMenuLens';
import type { ShelfMatch } from '@/lib/collectionStages';
import { menuRowShelf } from '@/lib/collectionStages';
import { allergenSummary, allergyLine, isMenuTeam, isStaffLens, rowStateMark } from '@/lib/menuLens';
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
  onNow: { name: string; itemIds: Set<string> } | null;
  /** Drinks new on this menu (no ended menu had them). */
  newIds: ReadonlySet<string> | undefined;
  shelf: ShelfMatch | null;
  day: (iso: string) => string;
  now: number;
}

export function menuPageModel({ menu, status, lens: L, venueName, onNow, newIds, shelf, day, now }: Input): MenuPageModel {
  const { lens } = L;
  const draft = status === 'draft';
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
      ...(onNow ? [{ label: 'Replaces', value: onNow.name, action: 'replaces' as const }] : []),
      ...(noPrice.length ? [{ label: 'Unfinished', value: `${plural(noPrice.length, 'drink')} ${noPrice.length === 1 ? 'has' : 'have'} no price`, warn: true, action: null }] : []),
    ];
  } else if (home && lens === 'home') {
    group = [
      { label: 'Shopping list', value: 'What to buy', action: 'shopping' },
      { label: 'Who’s coming', value: menu.guestCount ? plural(menu.guestCount, 'person', 'people') : 'Add a date and guests', action: 'night' },
    ];
  } else if (lens === 'employee') {
    const counts = new Map<string, number>();
    for (const labels of L.allergens.values()) for (const a of labels) counts.set(a, (counts.get(a) ?? 0) + 1);
    const fresh = drinks.filter((d) => newIds?.has(d.id)).map((d) => d.name);
    group = [
      { label: 'Allergens tonight', value: L.allergens.size ? allergenSummary(counts) : 'Not checked yet', action: null },
      ...(fresh.length ? [{ label: 'New this menu', value: fresh.join(', '), action: null }] : []),
    ];
  } else if (lens === 'bartender' && !past) {
    group = [
      { label: 'House-made for this menu', value: 'Prep list', action: 'prep' },
      { label: 'Also makes', value: 'What else we make', action: 'offMenu' },
    ];
  } else if (team && !past) {
    const on = status === 'on' ? [dates ?? 'on now', menu.endsAt ? `ends ${day(menu.endsAt)}` : 'no end date'].join(' · ') : (dates ?? 'No date');
    group = [
      { label: 'On', value: on, action: 'dates' },
      ...(L.averageCost ? [{ label: 'Costing', value: `average ${L.averageCost}`, action: 'costing' as const }] : []),
      ...(lens === 'creator' ? [{ label: 'Run sheet', value: '', action: 'runSheet' as const }] : []),
      ...(lens === 'admin' ? [{ label: 'On the bar page', value: 'Shown', action: 'barPage' as const }, { label: 'End this menu', value: '', action: 'end' as const }] : []),
    ];
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
  const stateOf = new Map(L.rows.map((r) => [r.itemId, r]));
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
      const row = team ? stateOf.get(d.id) : undefined;
      const mark = row ? rowStateMark(row.state, row.onFrom, row.offAt, day) : null;
      if (mark) flag = { label: mark, tone: row!.state.startsWith('waiting') ? 'amber' : 'quiet' };
      return {
        drink: d,
        line: lens === 'bartender' && notes?.method ? notes.method : d.line,
        end,
        endTone,
        sub: team && !draft ? (L.cost.get(d.id) ?? null) : null,
        flag,
        chips: lens === 'employee' ? (L.allergens.get(d.id) ?? (L.allergens.size ? [] : null)) : null,
        talkingPoint: lens === 'employee' ? (notes?.talkingPoint ?? null) : null,
        ink,
      };
    }),
  }));

  const after = past ? (isStaffLens(lens) ? null : 'Prices are left off past menus, so nobody orders from one. Staff still see them.') : null;
  return { ink, quiet: draft || past, tag, eyebrow, group, banner, sections, after };
}
