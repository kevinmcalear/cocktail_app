// A house-made spec line, opened in place (board drink-sheet-housemade): its
// recipe in parts, how many of this drink a batch makes, and when to start it.

const TO_ML: Record<string, number> = { ml: 1, cl: 10, l: 1000, oz: 29.5735 };

/** A volume in ml from an amount and unit; null for anything that isn't a volume. */
export function volumeMl(amount: number | null | undefined, unit: string | null | undefined): number | null {
  const per = TO_ML[(unit ?? '').trim().toLowerCase()];
  return amount != null && per ? amount * per : null;
}

export interface PartLine {
  name: string;
  amount: number | null;
  unit: string | null;
}

const half = (n: number) => Math.round(n * 2) / 2;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));

/**
 * "1 part", "2 parts" for every line measured in the same kind of unit as the
 * smallest; counts and odd units as written ("2 Fresno chilies"). Parts are
 * rounded to halves: a guide for making it, not the recipe card.
 */
export function inParts(lines: PartLine[]): { label: string; name: string }[] {
  const vols = lines.map((l) => volumeMl(l.amount, l.unit));
  const grams = lines.map((l) => ((l.unit ?? '').toLowerCase() === 'g' && l.amount ? l.amount : null));
  const base = (xs: (number | null)[]) => Math.min(...xs.filter((x): x is number => !!x && x > 0));
  const vBase = base(vols);
  const gBase = base(grams);
  return lines.map((l, i) => {
    const v = vols[i] ?? grams[i];
    const b = vols[i] != null ? vBase : gBase;
    if (v != null && Number.isFinite(b) && b > 0) {
      const p = half(v / b) || 0.5;
      return { label: `${fmt(p)} part${p === 1 ? '' : 's'}`, name: l.name };
    }
    return { label: l.amount != null ? [fmt(l.amount), l.unit && l.unit !== 'each' ? l.unit : null].filter(Boolean).join(' ') : '', name: l.name };
  });
}

/** "About 31": how many of this drink a batch of the prep makes. Null without both volumes. */
export function servesPerBatch(yieldAmount: number | null, yieldUnit: string | null, lineMl: number | null): number | null {
  const y = volumeMl(yieldAmount, yieldUnit);
  if (!y || !lineMl || lineMl <= 0) return null;
  return Math.floor(y / lineMl);
}

/** "Start 3 days before you need it."; null with no lead time. */
export function leadLine(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  if (minutes >= 24 * 60) {
    const days = Math.round(minutes / (24 * 60));
    return `Start ${days} day${days === 1 ? '' : 's'} before you need it.`;
  }
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60);
    return `Start ${hours} hour${hours === 1 ? '' : 's'} before you need it.`;
  }
  return `Takes about ${minutes} minutes.`;
}
