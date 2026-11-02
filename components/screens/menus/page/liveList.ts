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
  /** A list kept a drink at a time reads "since 1 Oct" (Menu-l-swap); a seasonal one keeps each drink's cost (Menu-who-creator). */
  living: boolean;
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

/** "1 to 30 Sep", "1 Oct to 1 Nov 2026": a drink's run, from dates or timestamps. */
export function runRange(from: string, to: string, year = false): string {
  const at = (s: string) => new Date(s.length === 10 ? `${s}T00:00` : s);
  const a = at(from);
  const b = at(to);
  const short = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const oneMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (a.getFullYear() !== b.getFullYear()) return `${short(a)} ${a.getFullYear()} to ${short(b)}${year ? ` ${b.getFullYear()}` : ''}`;
  const dayFirst = /^\d/.test(short(a));
  const range = oneMonth && a.getDate() === b.getDate() ? short(a) : !oneMonth ? `${short(a)} to ${short(b)}` : dayFirst ? `${a.getDate()} to ${short(b)}` : `${short(a)} to ${b.getDate()}`;
  return year ? `${range} ${b.getFullYear()}` : range;
}

export function liveList({ sections, sectionIds, rows, ended, endedDrinks, may, living, userId, nameOf, day, time, listStart, now }: Input) {
  const rowOf = new Map(rows.map((r) => [`${r.sectionId}:${r.itemId}`, r]));
  const names = new Map([...endedDrinks].map(([id, d]) => [id, d.name]));
  for (const s of sections) for (const v of s.rows) names.set(v.drink.id, v.drink.name);
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
      const swapFor = row.replacesItemId ? names.get(row.replacesItemId) : null;
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
        sub: living && since ? (fresh ? 'since today' : `since ${day(since)}`) : view.sub,
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
  const nameOfDrink = (id: string) => names.get(id);
  // The drink a swap put on, at the moment the other came off (a swap writes both at once).
  const swappedIn = (e: EndedRun) => rows.some((r) => r.replacesItemId === e.itemId && r.onFrom && Math.abs(Date.parse(r.onFrom) - Date.parse(e.cameOff)) < 60_000);
  const changes = [
    ...rows
      .filter((r) => (r.state === 'on' || r.state === 'going') && r.onFrom && Date.parse(r.onFrom) <= now)
      .map((r) => {
        const out = r.replacesItemId ? nameOfDrink(r.replacesItemId) : null;
        return { at: r.onFrom!, text: `${nameOfDrink(r.itemId) ?? 'A drink'} ${out ? `for ${out}` : 'on'}` };
      }),
    // A drink swapped out reads with the one that took its place, above.
    ...ended.filter((e) => !swappedIn(e)).map((e) => ({ at: e.cameOff, text: `${endedDrinks.get(e.itemId)?.name ?? 'A drink'} off` })),
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
