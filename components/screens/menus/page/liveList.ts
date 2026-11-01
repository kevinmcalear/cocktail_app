// A living list as the menu team sees it (2027 canvas, Menu-l-swap,
// Menu-l-swapped, Menu-l-approve, Menu-l-states): changes waiting for them
// on top, each drink's "since", a drink taken off today struck through with
// Undo, and drinks planned for later under Coming up. Kept pure: the screen
// wires the taps.
import type { EndedRun, ListRow } from '@/hooks/useLivingList';
import type { MenuDrink } from '@/types/menus';

import type { PageRowView } from './MenuPageRow';

export type ActKind = 'swap' | 'takeOff' | 'approve' | 'turnDown' | 'undo' | 'keep';
export interface Act {
  kind: ActKind;
  label: string;
}

export interface LiveSection {
  id: string;
  name: string;
  rows: PageRowView[];
}

interface Input {
  sections: LiveSection[];
  /** Section ids by name, to place a drink taken off today back in its section. */
  sectionIds: Map<string, string>;
  rows: ListRow[];
  ended: EndedRun[];
  /** Drinks that left today, by id: their names and pictures for the struck row. */
  endedDrinks: Map<string, MenuDrink>;
  /** The caller's changes go straight on (false: they wait for approval). */
  may: boolean;
  userId: string | null;
  /** "Sam" for who asked. */
  nameOf: (userId: string | null) => string | null;
  day: (iso: string) => string;
  time: (iso: string) => string;
  /** The list's own start, for a drink that went on with it. */
  listStart: string | null;
  now: number;
}

const sameDay = (a: string, now: number) => new Date(a).toDateString() === new Date(now).toDateString();

export function liveList({ sections, sectionIds, rows, ended, endedDrinks, may, userId, nameOf, day, time, listStart, now }: Input) {
  const rowOf = new Map(rows.map((r) => [`${r.sectionId}:${r.itemId}`, r]));
  const lead: PageRowView[] = [];
  const coming: PageRowView[] = [];
  const main = sections.map((s) => {
    const out: PageRowView[] = [];
    for (const view of s.rows) {
      const row = rowOf.get(`${s.id}:${view.drink.id}`);
      if (!row) {
        out.push(view);
        continue;
      }
      const asked = nameOf(row.state === 'waiting_off' ? row.offBy : row.addedBy);
      const swapFor = row.replacesItemId ? sections.flatMap((x) => x.rows).find((r) => r.drink.id === row.replacesItemId)?.drink.name : null;
      if (row.state === 'waiting_on' || row.state === 'waiting_off') {
        const on = row.state === 'waiting_on';
        // A take-off's ask isn't timed in the data (the row is as old as its run); a drink asked on is (the row is new).
        const what = [on ? `${asked ?? 'Someone'} asked at ${time(row.addedAt)}` : `${asked ?? 'Someone'} asked`, on ? (swapFor ? `on in place of ${swapFor}` : 'to go on') : 'to come off'].join(' · ');
        lead.push({
          ...view,
          line: what,
          sub: null,
          flag: { label: on ? 'Waiting' : 'Waiting to come off', tone: 'amber' },
          listRow: row,
          acts: may
            ? [
                { kind: 'approve', label: 'Approve' },
                { kind: 'turnDown', label: 'Turn down' },
              ]
            : row.addedBy === userId || row.offBy === userId
              ? [{ kind: 'turnDown', label: 'Withdraw' }]
              : [],
        });
        // A drink waiting to come off stays on the list until it is approved.
        if (!on) out.push({ ...view, flag: { label: 'Waiting', tone: 'amber' }, listRow: row, acts: [] });
        continue;
      }
      if (row.state === 'coming') {
        coming.push({
          ...view,
          line: [row.replacesItemId && swapFor ? `In place of ${swapFor}` : null, view.line].filter(Boolean).join(' · '),
          flag: { label: row.onFrom ? day(row.onFrom) : 'Coming', tone: 'quiet' },
          sub: null,
          listRow: row,
          acts: [{ kind: 'keep', label: 'Don’t put it on' }],
        });
        continue;
      }
      const since = row.onFrom ?? listStart;
      const fresh = !!row.onFrom && sameDay(row.onFrom, now);
      out.push({
        ...view,
        flag: row.state === 'going' ? { label: row.offAt ? `Off ${day(row.offAt)}` : 'Coming off', tone: 'quiet' } : fresh ? { label: 'New', tone: 'green' } : view.flag,
        sub: since ? (fresh ? 'since today' : `since ${day(since)}`) : view.sub,
        listRow: row,
        acts:
          row.state === 'going'
            ? [{ kind: 'keep', label: 'Keep it on' }]
            : [
                { kind: 'swap', label: 'Swap' },
                { kind: 'takeOff', label: 'Take off' },
              ],
      });
    }
    return { ...s, rows: out };
  });

  // Taken off today: struck through in its section, its run kept, with Undo while the drink swapped in is still there.
  for (const e of ended) {
    if (!sameDay(e.cameOff, now)) continue;
    const drink = endedDrinks.get(e.itemId);
    const sectionId = e.sectionName ? sectionIds.get(e.sectionName) : undefined;
    const section = main.find((s) => s.id === sectionId);
    if (!drink || !section) continue;
    // Back on already (Undo, or put on again today): nothing to strike.
    if (rows.some((r) => r.itemId === e.itemId && r.sectionId === sectionId)) continue;
    const swappedIn = rows.find((r) => r.replacesItemId === e.itemId && r.sectionId === sectionId);
    const at = section.rows.findIndex((r) => r.drink.id === swappedIn?.itemId);
    const struck: PageRowView = {
      drink,
      line: `Off today · its run is kept: ${day(e.wentOn)} to ${day(e.cameOff)}`,
      end: null,
      endTone: 'ink',
      sub: null,
      flag: null,
      chips: null,
      talkingPoint: null,
      ink: 'faded',
      struck: true,
      listRow: swappedIn,
      // Undo takes back the swap, or puts a drink taken off back on.
      acts: [{ kind: 'undo', label: 'Undo' }],
    };
    section.rows.splice(at >= 0 ? at + 1 : section.rows.length, 0, struck);
  }

  // The latest change: a drink on today or a day before, or one taken off.
  const changes = [
    ...rows.filter((r) => (r.state === 'on' || r.state === 'going') && r.onFrom && Date.parse(r.onFrom) <= now).map((r) => ({ at: r.onFrom!, text: `${sections.flatMap((s) => s.rows).find((v) => v.drink.id === r.itemId)?.drink.name ?? 'A drink'} on` })),
    ...ended.map((e) => ({ at: e.cameOff, text: `${endedDrinks.get(e.itemId)?.name ?? 'A drink'} off` })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const last = changes[0];
  const lastChange = last ? `${sameDay(last.at, now) ? `today ${time(last.at)}` : day(last.at)} · ${last.text}` : null;

  return {
    lead: lead.length ? { id: 'waiting', name: may ? 'Waiting for you' : 'Your changes', rows: lead } : null,
    main,
    coming: coming.length ? { id: 'coming', name: 'Coming up', rows: coming } : null,
    lastChange,
  };
}
