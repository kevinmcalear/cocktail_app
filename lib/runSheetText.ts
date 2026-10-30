/**
 * The run sheet in words: the header lines the sheet and its preview print,
 * and the whole sheet as plain text for a phone's Share (Messages, Mail,
 * Notes). Pure; lib/runSheet.ts builds the sheet.
 */

import { needGroups, type Need, type PartySheet, type RunSheet } from './runSheet';

export interface SheetHead {
  name: string;
  /** "Thu 22 Oct · 7 pm to 2 am · Caretaker's Cottage": the night, and the bar it's at. */
  when: string;
  /** "Little Rye visiting · with Mill & Ash Gin and Harbour Scotch · 610 serves across 5 drinks". */
  who: string;
  /** "Amounts to make and buy include 10% extra for testing and tasting.", or null with none. */
  extra: string | null;
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

export const andList = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;

type MenuWords = { name: string; startsAt: string | null; endsAt: string | null };

export function sheetHead(sheet: RunSheet, menu: MenuWords): SheetHead {
  const venue = sheet.parties.find((p) => p.role === 'Venue');
  const visiting = sheet.parties.find((p) => p.role === 'Visiting team');
  const brands = sheet.parties.filter((p) => p.role === 'Brand').map((p) => p.name);
  const drinks = sheet.drinks.filter((d) => d.serves > 0).length;
  return {
    name: menu.name,
    when: [nightLine(menu.startsAt, menu.endsAt), venue?.name].filter(Boolean).join(' · '),
    who: [
      visiting ? `${visiting.name} visiting` : null,
      brands.length ? `with ${andList(brands)}` : null,
      `${plural(sheet.totalServes, 'serve')} across ${plural(drinks, 'drink')}`,
    ]
      .filter(Boolean)
      .join(' · '),
    extra: sheet.marginPct > 0 ? `Amounts to make and buy include ${sheet.marginPct}% extra for testing and tasting.` : null,
  };
}

/** "16 things". */
export const thingCount = (n: number) => plural(n, 'thing');

/** "13.2 L · buy 19 × 700 ml". */
export const needAmount = (n: Pick<Need, 'amount' | 'detail' | 'group'>) => (n.detail && n.group !== 'glassware' ? `${n.amount} · ${n.detail}` : n.amount);

const KIND: Partial<Record<Need['group'], string>> = { glassware: 'glass', garnish: 'garnish', ice: 'ice' };

/** A need's name, saying what it is when the name alone doesn't: "Nude pony (glass)", "Cherry (garnish)". */
export function needName(n: Pick<Need, 'name' | 'group'>): string {
  const kind = KIND[n.group];
  return kind && !n.name.toLowerCase().includes(kind) ? `${n.name} (${kind})` : n.name;
}

/** "Nude pony (glass): 120", "Gin: 2.3 L · buy 4 × 700 ml". */
export const needLine = (n: Pick<Need, 'name' | 'group' | 'amount' | 'detail'>) => `${needName(n)}: ${needAmount(n)}`;

export interface PartyList {
  /** Whose list it is. */
  party: Pick<PartySheet, 'name' | 'role' | 'logoUrl'>;
  /** "FOR BAR LEONE". */
  eyebrow: string;
  /** "Your list for October at Leone". */
  title: string;
  when: string;
  /** "From Caretaker's Cottage". */
  from: string;
  /** A guest bar's own drinks on the menu, with the house preps they make for each. */
  drinks: { name: string; serves: number; makes: string[] }[];
  /** The bar it's at has things ready; everyone else brings theirs. */
  ask: 'Please have ready' | 'Please bring';
  needs: Need[];
  /** What everyone else brings, each thing in full. */
  others: Pick<PartySheet, 'name' | 'role' | 'logoUrl' | 'needs'>[];
  /** "Amounts to make and buy include 10% extra…" (SheetHead.extra). */
  extra: string | null;
  /** "Penicillin is on Cocktail, credited to Bar Leone. Claim your page to see it: <link>", while their page is unclaimed. */
  claim: string | null;
}

/**
 * One bar's or brand's part of the sheet, to send them (board R2): a guest
 * bar's own drinks, what they bring, then what everyone else does. We send
 * it, so it's from us. `claimUrl` is their unclaimed bar page, where they
 * can claim the drinks credited to them (board 10).
 */
export function partyList(sheet: RunSheet, menu: MenuWords, party: PartySheet, claimUrl?: string | null): PartyList {
  const us = sheet.parties.find((p) => p.id === null);
  const drinks = sheet.drinks
    .filter((d) => d.partyId !== null && d.partyId === party.id && d.serves > 0)
    .map((d) => ({ name: d.name, serves: d.serves, makes: party.needs.filter((n) => n.group === 'preps' && n.forDrinks.includes(d.name)).map((n) => n.name) }));
  const names = drinks.map((d) => d.name);
  return {
    party: { name: party.name, role: party.role, logoUrl: party.logoUrl },
    drinks,
    eyebrow: `For ${party.name}`.toUpperCase(),
    title: `Your list for ${menu.name}`,
    when: sheetHead(sheet, menu).when,
    extra: sheetHead(sheet, menu).extra,
    from: `From ${us?.name ?? 'us'}`,
    ask: party.role === 'Venue' ? 'Please have ready' : 'Please bring',
    needs: party.needs,
    others: sheet.parties.filter((p) => p !== party && p.needs.length),
    claim: claimUrl && names.length ? `${andList(names)} ${names.length === 1 ? 'is' : 'are'} on Cocktail, credited to ${party.name}. Claim your page to see ${names.length === 1 ? 'it' : 'them'}: ${claimUrl}` : null,
  };
}

/** "Penicillin × 120 (you make Honey-ginger syrup)". */
export const drinkLine = (d: PartyList['drinks'][number]) => `- ${d.name} × ${d.serves.toLocaleString('en-GB')}${d.makes.length ? ` (you make ${andList(d.makes)})` : ''}`;

/** One party's list as plain text, for Share or the clipboard. */
export function partyListText(list: PartyList): string {
  const out = [list.eyebrow, list.title, list.when, list.from];
  if (list.drinks.length) out.push('', 'YOUR DRINKS', ...list.drinks.map(drinkLine));
  if (list.extra) out.push(list.extra);
  if (list.needs.length) out.push('', list.ask.toUpperCase(), ...list.needs.map((n) => `- ${needLine(n)}`));
  if (list.others.length) out.push('', 'EVERYONE ELSE');
  for (const o of list.others) out.push(`${o.name} (${o.role})`, ...o.needs.map((n) => `- ${needLine(n)}`));
  if (list.claim) out.push('', list.claim);
  return out.join('\n');
}

/** The whole sheet as plain text, for Share on a phone. */
export function runSheetText(sheet: RunSheet, menu: MenuWords): string {
  const head = sheetHead(sheet, menu);
  const out = ['RUN SHEET', head.name, head.when, head.who, ...(head.extra ? [head.extra] : []), '', 'WHO BRINGS WHAT'];
  for (const party of sheet.parties) {
    if (!party.needs.length) continue;
    out.push('', `${party.name.toUpperCase()} (${party.role})`);
    for (const g of needGroups(party.needs)) out.push(`${g.title}:`, ...g.needs.map((n) => `- ${needLine(n)}`));
  }
  out.push('', 'THE DRINKS');
  for (const d of sheet.drinks) {
    if (!d.serves) continue;
    out.push('', `${d.name} × ${d.serves.toLocaleString('en-GB')}`);
    if (d.serve) out.push(d.serve);
    for (const p of d.parts ?? [null]) {
      if (p) out.push(`${p.n} ${p.name}${p.joins ? ` (${p.joins})` : ''}`);
      for (const l of (p?.lines ?? d.lines).filter((x) => !x.garnish)) out.push(`- ${l.name}: ${[l.per, l.total ? `${l.total} for ${d.serves}` : null].filter(Boolean).join(', ')}`);
    }
  }
  return out.join('\n');
}
