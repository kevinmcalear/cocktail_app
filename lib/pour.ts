/**
 * The words a beer, wine or bottle page uses for how it's poured and how
 * strong it is (canvas HFuAk, Item-page beer, wine and bottle): the facts a
 * menu gives, and the bar team's Pour it rows. Pure; BeerWineScreen and the
 * ingredient page render them.
 */

import { formatQuantity, toQuantity, type Quantity } from '@/lib/quantity';

export interface PourItem {
  abv: number | null;
  serve_ml: number | null;
  price: string | null;
  bottle_price?: string | null;
  serve_temp_c?: number | null;
  glass_note?: string | null;
  pour_note?: string | null;
  tap_line?: string | null;
}

export interface FactLine {
  label: string;
  value: string;
}

const clean = (s: string | null | undefined) => s?.trim() || null;
/** A note after a comma reads in lower case ("Pilsner, rinsed cold"), unless it starts with a name or an acronym. */
const after = (s: string | null | undefined) => {
  const t = clean(s);
  return t && !/^[A-Z]{2}/.test(t) ? t[0].toLowerCase() + t.slice(1) : t;
};

/** "$9" from "9" or "9.00"; "MP" stays "MP". */
export function money(price: string | null | undefined): string | null {
  const p = clean(price);
  if (!p) return null;
  return /^\$?\d+(\.\d+)?$/.test(p) ? `$${p.replace(/^\$/, '')}` : p;
}

/** "4.8%": a strength as a menu prints it. */
export function percent(abv: number | null | undefined): string | null {
  return abv == null || !Number.isFinite(Number(abv)) ? null : `${Number(abv)}%`;
}

/**
 * A kind of spirit's strength from the bottles of it: "Usually 40 to 46%",
 * or one figure when they agree. Its own strength wins when it has one.
 */
export function strengthLine(abv: number | null | undefined, bottles: readonly { abv?: number | null }[] = []): string | null {
  const own = percent(abv);
  if (own) return own;
  const all = bottles.map((x) => Number(x.abv)).filter((n) => Number.isFinite(n) && n > 0);
  if (!all.length) return null;
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  return lo === hi ? `Usually ${lo}%` : `Usually ${lo} to ${hi}%`;
}

/** How cold it goes out, in a guest's words: a pilsner at 3°C is "Very cold". */
export function servedWords(tempC: number | null | undefined): string | null {
  if (tempC == null) return null;
  if (tempC <= 4) return 'Very cold';
  if (tempC <= 8) return 'Cold';
  if (tempC <= 13) return 'Cellar cool';
  if (tempC <= 18) return 'Cool';
  return 'Room temperature';
}

/** "pilsner glass" from "Pilsner"; a name that already says glass stays as it is. */
function glassWords(glass: string): string {
  const g = glass.trim().toLowerCase();
  return /glass|mug|stein|tankard|can|bottle/.test(g) ? g : `${g} glass`;
}

/**
 * The facts a menu gives (board Item-page, guest): beer reads Strength, Pour
 * (size and price) and Served (how cold, which glass); wine reads Strength,
 * Glass (size and price) and Bottle.
 */
export function pourFacts(kind: 'beer' | 'wine', item: PourItem, glass: string | null): FactLine[] {
  const pour = [item.serve_ml ? `${item.serve_ml} ml` : null, money(item.price)].filter(Boolean).join(' · ');
  const served = [servedWords(item.serve_temp_c), glass ? glassWords(glass) : null].filter(Boolean).join(', ');
  const rows: (FactLine | null)[] = [
    percent(item.abv) ? { label: 'Strength', value: percent(item.abv)! } : null,
    pour ? { label: kind === 'wine' ? 'Glass' : 'Pour', value: pour } : null,
    kind === 'wine' ? (money(item.bottle_price) ? { label: 'Bottle', value: money(item.bottle_price)! } : null) : served ? { label: 'Served', value: served[0].toUpperCase() + served.slice(1) } : null,
  ];
  return rows.filter((r): r is FactLine => !!r);
}

/**
 * Pour it, for the bar's team (board Item-page, staff): the glass and what it
 * gets ("Pilsner, rinsed cold"), the pour ("400 ml, two fingers of head";
 * wine adds "served at 16°C", which beer's guests already read as words),
 * and the tap line a beer is on.
 */
export function pourRows(kind: 'beer' | 'wine', item: PourItem, glass: string | null): FactLine[] {
  const glassRow = glass ? [glass, after(item.glass_note)].filter(Boolean).join(', ') : clean(item.glass_note);
  const pour = [item.serve_ml ? `${item.serve_ml} ml` : null, item.serve_ml ? after(item.pour_note) : clean(item.pour_note), kind === 'wine' && item.serve_temp_c != null ? `served at ${item.serve_temp_c}°C` : null].filter(Boolean).join(', ');
  const tap = kind === 'beer' ? clean(item.tap_line) : null;
  const rows: (FactLine | null)[] = [glassRow ? { label: 'Glass', value: glassRow } : null, pour ? { label: 'Pour', value: pour } : null, tap ? { label: 'On tap', value: tap } : null];
  return rows.filter((r): r is FactLine => !!r);
}

/**
 * A bottle's row under Used in (board Item-page, bottle staff): its role, then
 * how much the drink pours ("Float, 7.5 ml"). A small pour keeps its half
 * (¼ oz reads 7.5 ml), a bigger one is whole (½ oz reads 15 ml).
 */
export function usedInWords(pour: { amount: number | string | null; unit: string | null; float?: boolean }, garnish = false): string {
  const q = toQuantity(pour.amount, pour.unit);
  const ml = q?.kind === 'ml' ? { ...q, value: q.value < 10 ? Math.round(q.value * 2) / 2 : Math.round(q.value) } : q;
  const role = pour.float ? 'Float' : garnish ? 'Garnish' : null;
  const amount = ml && !garnish ? formatQuantity(ml) : null;
  return [role, amount].filter(Boolean).join(', ');
}

/** What the bar has of a bottle, from its last count (board Item-page, "At Caretaker's": "2 on hand"). */
export function onHandWords(q: Quantity | undefined): string {
  if (!q) return 'Not counted';
  if (q.value <= 0) return 'None on hand';
  const bottles = q.kind === 'count' && ['btl', 'bottle', 'bottles', 'each'].includes(q.unit);
  return `${bottles ? Number(q.value.toFixed(1)) : formatQuantity(q)} on hand`;
}
