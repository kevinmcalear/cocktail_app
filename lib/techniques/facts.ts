/**
 * The library's small readings, pure so facts.check.ts can hold them: a
 * technique page's three fact tiles and a group row's member line.
 */
import type { Storage, Technique } from './types';

export interface FactTile {
  value: string;
  caption: string;
}

const KEPT: Record<Storage, string> = { fridge: 'cold, to be safe', freezer: 'frozen', ambient: 'at room temperature', airtight: 'sealed tight' };

/** "2 weeks", "3 days", "12 h": the keep in the biggest whole unit. */
export function keepLabel(hours: number): string {
  if (hours >= 24 * 7 && hours % (24 * 7) === 0) return `${hours / (24 * 7)} ${hours === 24 * 7 ? 'week' : 'weeks'}`;
  if (hours >= 24 && hours % 24 === 0) return `${hours / 24} ${hours === 24 ? 'day' : 'days'}`;
  if (hours >= 1) return `${Math.round(hours)} h`;
  return `${Math.round(hours * 60)} min`;
}

/** "1 : 4" when one part is a whole fraction of the base in the same unit, else null. */
export function ratioTile(t: Pick<Technique, 'base' | 'parts'>): FactTile | null {
  if (!t.base || t.parts?.length !== 1) return null;
  const [p] = t.parts;
  if (p.unit !== t.base.unit || !(p.per > 0) || p.per >= 1) return null;
  const n = 1 / p.per;
  if (Math.abs(n - Math.round(n)) > 0.01) return null;
  return { value: `1 : ${Math.round(n)}`, caption: `${p.name.toLowerCase()} : ${t.base.name.toLowerCase()}` };
}

/** How long it takes, its ratio when it has one, and how long it keeps. */
export function factTiles(t: Pick<Technique, 'time' | 'base' | 'parts' | 'keeps' | 'keepsHours' | 'storage'>): FactTile[] {
  const tiles: FactTile[] = [{ value: t.time, caption: 'start to finish' }];
  const ratio = ratioTile(t);
  if (ratio) tiles.push(ratio);
  if (typeof t.keepsHours === 'number' && t.keepsHours > 0) tiles.push({ value: keepLabel(t.keepsHours), caption: t.storage ? KEPT[t.storage] : 'keeps' });
  else if (t.keeps) tiles.push({ value: t.keeps, caption: 'keeps' });
  return tiles;
}

/** "Dry shake, siphon, lecithin air": a group's first few techniques, the rest lower case. */
export function membersLine(names: readonly string[], max = 4): string {
  return names
    .slice(0, max)
    .map((n, i) => (i === 0 || /^[A-Z]\p{Ll}/u.test(n) === false ? n : n[0].toLowerCase() + n.slice(1)))
    .join(', ');
}

/** The swap as one callout sentence: "Vegan: coconut milk" reads "Vegan swap: coconut milk". */
export function swapLine(swap: string): string {
  const m = /^([A-Z][\w -]{0,20}):\s*(.+)$/s.exec(swap.trim());
  return m ? `${m[1]} swap: ${m[2]}` : `Swap: ${swap.trim()}`;
}
