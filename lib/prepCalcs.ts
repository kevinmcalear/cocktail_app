/**
 * Amounts for a house-made ingredient: super juice, syrup, foam, cordial, soda.
 * Ratios are the published ones (peel-weight acids, water at 16.66× for ~6%
 * acid, honey water at 0.64×). Pure; the prep calculator renders them.
 */

export type Citrus = 'lemon' | 'lime' | 'orange' | 'grapefruit' | 'kumquat';
export type SyrupKind = 'one' | 'rich' | 'honey' | 'agave';
export type CordialRatio = '2:1' | '3:2' | '1:1';
export type PrepKind = 'juice' | 'syrup' | 'foam' | 'cordial' | 'soda';

export interface PrepLine {
  name: string;
  amount: number;
  unit: 'g' | 'ml';
}

/** Water per gram of peel so the acids land near 6%. 100 g of peel → 1666 g. */
const WATER = 16.66;

const JUICE: Record<Citrus, { peel: string; citric: number; malic: number; msg?: number; water: number }> = {
  lemon: { peel: 'Lemon peels', citric: 1, malic: 0, water: WATER },
  // 2:1 citric to malic, equal to the peel weight.
  lime: { peel: 'Lime peels', citric: 2 / 3, malic: 1 / 3, water: WATER },
  orange: { peel: 'Orange peels', citric: 0.9, malic: 0.1, water: WATER },
  grapefruit: { peel: 'Grapefruit peels', citric: 0.8, malic: 0.2, msg: 0.033, water: WATER },
  // Whole fruit. A quarter of the weight stands in for the peel; water follows that acid.
  kumquat: { peel: 'Kumquats', citric: 0.25, malic: 0, water: 0.25 * WATER },
};

export function superJuice(citrus: Citrus, grams: number): PrepLine[] | null {
  if (!(grams > 0)) return null;
  const c = JUICE[citrus];
  const lines: PrepLine[] = [
    { name: c.peel, amount: grams, unit: 'g' },
    { name: 'Citric acid', amount: grams * c.citric, unit: 'g' },
  ];
  if (c.malic) lines.push({ name: 'Malic acid', amount: grams * c.malic, unit: 'g' });
  if (c.msg) lines.push({ name: 'MSG', amount: grams * c.msg, unit: 'g' });
  lines.push({ name: 'Water', amount: grams * c.water, unit: 'g' });
  return lines;
}

/** Finished syrup, by weight. Honey and agave are watered to about 50% sugar. */
export function syrup(kind: SyrupKind, wantG: number): PrepLine[] | null {
  if (!(wantG > 0)) return null;
  if (kind === 'one') return [{ name: 'Sugar', amount: wantG / 2, unit: 'g' }, { name: 'Water', amount: wantG / 2, unit: 'g' }];
  if (kind === 'rich') return [{ name: 'Sugar', amount: (wantG * 2) / 3, unit: 'g' }, { name: 'Water', amount: wantG / 3, unit: 'g' }];
  const sweet = wantG / 1.64;
  return [{ name: kind === 'honey' ? 'Honey' : 'Agave', amount: sweet, unit: 'g' }, { name: 'Water', amount: sweet * 0.64, unit: 'g' }];
}

/** Super foam, scaled from a 500 g water batch. */
const FOAM: readonly { name: string; g: number }[] = [
  { name: 'Water', g: 500 },
  { name: 'Methylcellulose', g: 3 },
  { name: 'Xanthan gum', g: 0.3 },
  { name: 'Gum arabic', g: 20 },
];

export function foam(wantG: number): PrepLine[] | null {
  if (!(wantG > 0)) return null;
  const scale = wantG / 500;
  return FOAM.map((l) => ({ name: l.name, amount: l.g * scale, unit: 'g' }));
}

const CORDIAL: Record<CordialRatio, readonly [number, number]> = { '2:1': [2, 1], '3:2': [3, 2], '1:1': [1, 1] };

/** Syrup to citrus juice. Volumes add; a 6% acid solution can stand in for the juice. */
export function cordial(ratio: CordialRatio, wantMl: number): PrepLine[] | null {
  if (!(wantMl > 0)) return null;
  const [s, j] = CORDIAL[ratio];
  return [
    { name: 'Syrup', amount: (wantMl * s) / (s + j), unit: 'ml' },
    { name: 'Citrus juice', amount: (wantMl * j) / (s + j), unit: 'ml' },
  ];
}

/** 30 ml syrup and 170 ml carbonated water per 200 ml. */
export function soda(wantMl: number): PrepLine[] | null {
  if (!(wantMl > 0)) return null;
  return [
    { name: 'Syrup', amount: (wantMl * 30) / 200, unit: 'ml' },
    { name: 'Carbonated water', amount: (wantMl * 170) / 200, unit: 'ml' },
  ];
}

export function formatPrepAmount(n: number): string {
  const digits = n >= 100 ? 1 : 2;
  return String(Number(n.toFixed(digits)));
}

export interface PrepRecipeLine {
  ingredient_id: string;
  name: string;
  amount: string;
  unit: string;
}

/** Pair each calculated line with a catalog ingredient of the same name. Unmatched lines have a null id. */
export function matchPrepLines(lines: PrepLine[], catalog: { id: string; name: string }[]): (Omit<PrepRecipeLine, 'ingredient_id'> & { ingredient_id: string | null })[] {
  const byName = new Map<string, { id: string; name: string }>();
  for (const item of catalog) {
    const key = item.name.trim().toLowerCase();
    if (key && !byName.has(key)) byName.set(key, item);
  }
  return lines.map((line) => {
    const hit = byName.get(line.name.trim().toLowerCase());
    return { ingredient_id: hit?.id ?? null, name: hit?.name ?? line.name, amount: formatPrepAmount(line.amount), unit: line.unit };
  });
}

/** Update a recipe line that is already there; append the rest. */
export function mergePrepRecipe<T extends PrepRecipeLine>(prev: T[], added: PrepRecipeLine[]): T[] {
  const next = [...prev];
  for (const line of added) {
    const i = next.findIndex((l) => l.ingredient_id === line.ingredient_id);
    if (i >= 0) next[i] = { ...next[i], name: line.name, amount: line.amount, unit: line.unit };
    else next.push(line as T);
  }
  return next;
}

export interface PrepGuess {
  kind: PrepKind;
  citrus: Citrus;
  syrup: SyrupKind;
}

/** Which calculator a drink or ingredient name is asking for. */
export function guessPrep(name: string): PrepGuess {
  const n = name.toLowerCase();
  const base: PrepGuess = { kind: 'juice', citrus: 'lemon', syrup: 'one' };
  if (/foam/.test(n)) return { ...base, kind: 'foam' };
  if (/cordial/.test(n)) return { ...base, kind: 'cordial' };
  if (/soda|tonic/.test(n)) return { ...base, kind: 'soda' };
  if (/honey/.test(n)) return { ...base, kind: 'syrup', syrup: 'honey' };
  if (/agave/.test(n)) return { ...base, kind: 'syrup', syrup: 'agave' };
  if (/rich/.test(n)) return { ...base, kind: 'syrup', syrup: 'rich' };
  if (/syrup|gomme/.test(n)) return { ...base, kind: 'syrup', syrup: 'one' };
  if (/kumquat/.test(n)) return { ...base, kind: 'juice', citrus: 'kumquat' };
  if (/grapefruit/.test(n)) return { ...base, kind: 'juice', citrus: 'grapefruit' };
  if (/orange/.test(n)) return { ...base, kind: 'juice', citrus: 'orange' };
  if (/lime/.test(n)) return { ...base, kind: 'juice', citrus: 'lime' };
  return base;
}
