/**
 * The run sheet in words: the header lines the sheet and its preview print,
 * and the whole sheet as plain text for a phone's Share (Messages, Mail,
 * Notes). Pure; lib/runSheet.ts builds the sheet.
 */

import type { Need, RunSheet } from './runSheet';

export interface SheetHead {
  name: string;
  /** "Thu 22 Oct · 7 pm to 2 am · Caretaker's Cottage". */
  when: string;
  /** "Little Rye behind the bar · with Mill & Ash Gin and Harbour Scotch · 610 serves across 5 drinks". */
  who: string;
}

const time = (d: Date) => {
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes();
  return `${h}${m ? `:${String(m).padStart(2, '0')}` : ''} ${d.getHours() < 12 ? 'am' : 'pm'}`;
};

/** "Thu 22 Oct · 7 pm to 2 am", or null with no date. A date with no time (a home menu's night) is just the day. */
export function nightLine(startsAt: string | null, endsAt: string | null): string | null {
  if (!startsAt) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(startsAt);
  const start = new Date(dateOnly ? `${startsAt}T12:00:00` : startsAt);
  if (Number.isNaN(start.getTime())) return null;
  const day = start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  if (dateOnly) return day;
  const end = endsAt ? new Date(endsAt) : null;
  return `${day} · ${time(start)}${end && !Number.isNaN(end.getTime()) ? ` to ${time(end)}` : ''}`;
}

const andList = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;

export function sheetHead(sheet: RunSheet, menu: { name: string; startsAt: string | null; endsAt: string | null }): SheetHead {
  const host = sheet.parties[0];
  const guest = sheet.parties.find((p) => p.role === 'Guest venue');
  const brands = sheet.parties.filter((p) => p.role === 'Brand').map((p) => p.name);
  const drinks = sheet.drinks.filter((d) => d.serves > 0).length;
  return {
    name: menu.name,
    when: [nightLine(menu.startsAt, menu.endsAt), host?.name].filter(Boolean).join(' · '),
    who: [
      guest ? `${guest.name} behind the bar` : null,
      brands.length ? `with ${andList(brands)}` : null,
      `${plural(sheet.totalServes, 'serve')} across ${plural(drinks, 'drink')}`,
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

/** "16 things". */
export const thingCount = (n: number) => plural(n, 'thing');

/** "13.2 L · 19 × 700 ml". */
export const needAmount = (n: Pick<Need, 'amount' | 'detail' | 'group'>) => (n.detail && n.group !== 'glassware' ? `${n.amount} · ${n.detail}` : n.amount);

/** The whole sheet as plain text, for Share on a phone. */
export function runSheetText(sheet: RunSheet, menu: { name: string; startsAt: string | null; endsAt: string | null }): string {
  const head = sheetHead(sheet, menu);
  const out = ['RUN SHEET', head.name, head.when, head.who, '', 'WHO BRINGS WHAT'];
  for (const party of sheet.parties) {
    if (!party.needs.length) continue;
    out.push('', `${party.name} (${party.role})`, ...party.needs.map((n) => `- ${n.name}: ${needAmount(n)}`));
  }
  out.push('', 'THE DRINKS');
  for (const d of sheet.drinks) {
    if (!d.serves) continue;
    out.push('', `${d.name} × ${d.serves.toLocaleString('en-GB')}`);
    if (d.serve) out.push(d.serve);
    for (const l of d.lines.filter((x) => !x.garnish)) out.push(`- ${l.name}: ${[l.per, l.total ? `${l.total} for ${d.serves}` : null].filter(Boolean).join(', ')}`);
  }
  return out.join('\n');
}
