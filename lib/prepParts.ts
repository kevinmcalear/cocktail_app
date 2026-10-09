/**
 * A prep recipe read as parts ("2 parts sugar, 1 part water") and the sizes it
 * can be made in on its page. Pure; components/screens/ingredient uses it.
 */

import { toQuantity } from '@/lib/quantity';
import type { RecipeLine } from '@/lib/scale';

/** "½ part", "1 part", "2 parts", "1½ parts". */
export function partsLabel(parts: number): string {
  const whole = Math.floor(parts);
  const half = parts - whole >= 0.5;
  const text = `${whole || ''}${half ? '½' : ''}` || '0';
  return `${text} ${parts > 1 ? 'parts' : 'part'}`;
}

/**
 * Each line as parts of the smallest measured one, or null when the recipe
 * doesn't read as parts: fewer than two measured lines, weights mixed with
 * volumes other than water-like ones, or shares that aren't near a half step.
 * Counted lines (2 chilies) keep their own amount; unmeasured ones read "".
 * ponytail: ml counts as g (water's density), right for the syrups, shrubs
 * and cordials this is for; a recipe heavy on honey or spirit reads slightly off.
 */
export function prepParts(lines: RecipeLine[]): string[] | null {
  const qs = lines.map((l) => toQuantity(l.amount, l.unit));
  const measured = qs.filter((q) => q && q.kind !== 'count').map((q) => q!.value);
  if (measured.length < 2) return null;
  const base = Math.min(...measured);
  if (base <= 0) return null;
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const q = qs[i];
    if (!q) {
      out.push('');
      continue;
    }
    if (q.kind === 'count') {
      out.push(String(lines[i].amount ?? ''));
      continue;
    }
    const share = q.value / base;
    const step = Math.round(share * 2) / 2;
    if (step > 12 || Math.abs(share - step) / step > 0.03) return null;
    out.push(partsLabel(step));
  }
  return out;
}

/** "2 : 1", "1 : 1 : 1", for the line under the recipe heading. */
export function partsRatio(parts: string[] | null): string | null {
  if (!parts) return null;
  const nums = parts.filter((p) => /part/.test(p)).map((p) => p.split(' ')[0]);
  return nums.length >= 2 ? nums.join(' : ') : null;
}

export interface SizeOption {
  key: string;
  label: string;
  /** Multiplies one batch. */
  factor: number;
}

/**
 * The sizes on a prep page: one batch, half and double, and when the yield is
 * a volume, the bottles people fill (skipping one that's the batch itself).
 */
export function sizeOptions(yieldAmount: number | null, yieldUnit: string | null): SizeOption[] {
  const out: SizeOption[] = [
    { key: 'batch', label: '1 batch', factor: 1 },
    { key: 'half', label: '½', factor: 0.5 },
    { key: 'double', label: '2×', factor: 2 },
  ];
  const y = toQuantity(yieldAmount, yieldUnit);
  if (y?.kind === 'ml' && y.value > 0) {
    for (const [ml, label] of [[500, '500 ml'], [750, 'Fill a 750 ml bottle'], [1000, '1 L']] as const) {
      if (Math.abs(ml - y.value) / y.value > 0.05) out.push({ key: `ml${ml}`, label, factor: ml / y.value });
    }
  }
  return out;
}

/** "About 75 drinks at 15 ml": how far one batch goes in its most common pour. */
export function poursPerBatch(yieldAmount: number | null, yieldUnit: string | null, pours: { amount: number | string | null; unit: string | null }[]): string | null {
  const y = toQuantity(yieldAmount, yieldUnit);
  if (!y || y.kind !== 'ml') return null;
  const counts = new Map<number, number>();
  for (const p of pours) {
    const q = toQuantity(p.amount, p.unit);
    // Whole ml, so ½ oz (14.8 ml) and 15 ml count as the same pour.
    const ml = q?.kind === 'ml' ? Math.round(q.value) : 0;
    if (ml > 0) counts.set(ml, (counts.get(ml) ?? 0) + 1);
  }
  const common = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0];
  if (!common) return null;
  const n = Math.floor(y.value / common);
  return n >= 2 ? `One batch pours about ${n} drinks at ${common} ml.` : null;
}
