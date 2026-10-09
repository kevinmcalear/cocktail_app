/**
 * Making a house prep from a kind: a syrup, a shrub, a cordial and so on,
 * each with its parts, a method, how long it keeps and how much it makes.
 * A new prep starts from one of these and the maker changes what they like.
 * Pure and plain JSON (the draft lives in the drink wizard's stored draft);
 * the screens are components/screens/addDrink/prep.
 *
 * Starting points, not lab results: keeps and yields are conservative and
 * say "about". Sources: Difford's (simple and rich syrup), Punch (citric 2%
 * of juice for a cordial), Hilda's Kitchen (super juice per gram of peel).
 */

export type PrepKindId = 'syrup' | 'rich' | 'shrub' | 'cordial' | 'oleo' | 'infusion' | 'super' | 'other';

export interface PrepDraftLine {
  key: string;
  id: string | null;
  name: string;
  /** Parts of the recipe, beside the base line's; null for a line with its own amount (2 chilies). */
  parts: number | null;
  unit: string;
  /** Used when parts is null: what's typed ("2", "" for to taste). */
  amount: string;
  /** ml one unit of it adds to the batch, for the yield guess (water 1, sugar 0.62). */
  yieldPer?: number;
}

export interface PrepDraftStep {
  body: string;
  timer_seconds: number | null;
}

export interface PrepDraft {
  kind: PrepKindId;
  /** Shrubs: made cold (days, brighter) or hot (an hour, jammier). */
  hot?: boolean;
  /** The line everything follows, and how much of it. */
  baseKey: string;
  baseAmount: number;
  lines: PrepDraftLine[];
  steps: PrepDraftStep[];
  keepsHours: number | null;
  storage: string;
  /** How far ahead to start it. */
  leadMinutes: number | null;
  actions: string[];
  /** A technique from the library (lib/techniques) it was started from. */
  technique?: string;
}

export interface PrepKind {
  id: PrepKindId;
  name: string;
  /** "Sugar and water, 2 : 1". */
  ratio: string;
}

export const PREP_KINDS: PrepKind[] = [
  { id: 'syrup', name: 'Syrup', ratio: 'Sugar and water, 1 : 1' },
  { id: 'rich', name: 'Rich syrup', ratio: 'Sugar and water, 2 : 1' },
  { id: 'shrub', name: 'Shrub', ratio: 'Fruit, sugar, vinegar' },
  { id: 'cordial', name: 'Cordial', ratio: 'Juice, sugar, acid' },
  { id: 'oleo', name: 'Oleo saccharum', ratio: 'Peels and sugar' },
  { id: 'infusion', name: 'Infusion', ratio: 'Spirit plus a flavour' },
  { id: 'super', name: 'Super juice', ratio: 'Peels, acids, water' },
  { id: 'other', name: 'Something else', ratio: 'Start blank' },
];

const DAY = 24;
const WEEK = 7 * DAY;
const KIND_WORDS: [RegExp, PrepKindId][] = [
  [/\bsuper\s*juice\b/i, 'super'],
  [/\brich\b.*\bsyrup\b|\b2\s*:\s*1\b/i, 'rich'],
  [/\bshrub\b/i, 'shrub'],
  [/\bcordial\b/i, 'cordial'],
  [/\boleo\b/i, 'oleo'],
  [/\b(infused|infusion|tincture)\b/i, 'infusion'],
  [/\bsyrup\b|\bgomme\b/i, 'syrup'],
];

/** The kind a name says it is ("Pineapple chili shrub" is a shrub), or null. */
export function guessKind(name: string): PrepKindId | null {
  return KIND_WORDS.find(([re]) => re.test(name))?.[1] ?? null;
}

/** "Pineapple chili shrub" → ["Pineapple", "Chili"]: the flavour words, without the kind's. */
export function flavourWords(name: string): string[] {
  const rest = name
    .replace(/\b(super\s*juice|rich|simple|syrup|shrub|cordial|oleo|saccharum|infused|infusion|tincture|gomme|house|homemade)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return rest.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

let n = 0;
const key = () => `p${Date.now().toString(36)}${(n++).toString(36)}`;
const line = (name: string, parts: number | null, unit: string, yieldPer?: number, amount = ''): PrepDraftLine => ({ key: key(), id: null, name, parts, unit, amount, yieldPer });

/**
 * A new prep's draft from a kind and its name: the kind's parts with the
 * name's flavour as the base, its method, keeps and lead time.
 */
export function startPrep(kind: PrepKindId, name: string, hot = false): PrepDraft {
  const [flavour = '', ...extra] = flavourWords(name);
  const extras = extra.map((w) => line(w, null, '', 0));
  const draft = (lines: PrepDraftLine[], baseAmount: number, steps: PrepDraftStep[], keepsHours: number | null, storage: string, leadMinutes: number | null, actions: string[]): PrepDraft => ({
    kind, hot: kind === 'shrub' ? hot : undefined, baseKey: lines[0].key, baseAmount, lines, steps, keepsHours, storage, leadMinutes, actions,
  });
  const s = (body: string, timer_seconds: number | null = null) => ({ body, timer_seconds });
  const fridge = 'Fridge, sealed bottle';
  switch (kind) {
    case 'syrup':
    case 'rich': {
      const rich = kind === 'rich';
      return draft([line('Sugar', rich ? 2 : 1, 'g', 0.62), line('Water', 1, 'ml', 1)], rich ? 1000 : 500, [
        s('Combine the sugar and water in a pan over low heat.'),
        s('Stir until every crystal has dissolved and it’s clear. Take it off before it simmers.'),
        s('Cool, bottle, label with the date and keep in the fridge.'),
      ], rich ? 8 * WEEK : 4 * WEEK, fridge, 20, ['Syrup']);
    }
    case 'shrub':
      return draft([line(flavour || 'Fruit', 1, 'g', 0.6), line('Sugar', 1, 'g', 0.62), line('Apple cider vinegar', 1, 'g', 1), ...extras], 300, hot
        ? [
            s('Chop the fruit. Warm it with the sugar and a splash of water, stirring, until it breaks down.', 20 * 60),
            s('Strain, pressing the fruit, and leave to cool.'),
            s('Stir in the vinegar, bottle and keep in the fridge.'),
          ]
        : [
            s('Chop the fruit and toss it with the sugar.'),
            s('Cover and leave in the fridge until it’s syrupy.', DAY * 3600),
            s('Strain, pressing the fruit. Scrape in any sugar left behind.'),
            s('Stir in the vinegar until the sugar is gone.'),
            s('Bottle and rest in the fridge for 2 days before using.'),
          ], 4 * WEEK, fridge, hot ? 60 : 3 * DAY * 60, ['Infuse', 'Strain']);
    case 'cordial':
      return draft([line(flavour ? `${flavour} juice` : 'Juice', 1, 'g', 1), line('Sugar', 1, 'g', 0.62), line('Citric acid', 0.02, 'g', 0), ...extras], 500, [
        s('Stir the sugar and citric acid into the juice until they dissolve. No heat.'),
        s('Bottle and keep cold.'),
      ], 2 * WEEK, fridge, 15, ['Mix']);
    case 'oleo':
      return draft([line(flavour ? `${flavour} peels` : 'Citrus peels', 1, 'g', 0.3), line('Sugar', 1, 'g', 0.62), ...extras], 200, [
        s('Muddle the peels with the sugar.'),
        s('Cover and leave at room temperature until the sugar is wet.', 4 * 3600),
        s('Stir, then strain, pressing the peels.'),
      ], 2 * WEEK, fridge, 5 * 60, ['Infuse', 'Strain']);
    case 'infusion':
      return draft([line('Spirit', 1, 'ml', 0.95), line(flavour || 'Flavour', 0.1, 'g', 0), ...extras], 700, [
        s('Add the flavour to the spirit in a clean jar.'),
        s('Leave to infuse, tasting now and then.', DAY * 3600),
        s('Strain and bottle.'),
      ], 26 * WEEK, 'Ambient, dark', DAY * 60, ['Infuse', 'Strain']);
    case 'super':
      return draft([line(flavour ? `${flavour} peels` : 'Lime peels', 1, 'g', 0.3), line('Citric acid', 0.66, 'g', 0.6), line('Malic acid', 0.33, 'g', 0.6), line('Water', 16.67, 'ml', 1)], 60, [
        s('Cover the peels with the acids and leave them to draw.', 3600),
        s('Add the water and blend until smooth.'),
        s('Strain through a fine cloth, bottle and keep cold.'),
      ], 3 * DAY, fridge, 90, ['Blend', 'Strain']);
    case 'other':
      return draft([line(flavour || 'Main ingredient', 1, 'g'), ...extras], 100, [], null, fridge, null, []);
  }
}

/** How much of each line, from the base amount and the parts. */
export function prepAmounts(d: PrepDraft): { line: PrepDraftLine; amount: number | null }[] {
  const base = d.lines.find((l) => l.key === d.baseKey);
  const perPart = base?.parts ? d.baseAmount / base.parts : null;
  return d.lines.map((l) => {
    if (l.parts !== null && perPart !== null) return { line: l, amount: Math.round(l.parts * perPart * 10) / 10 };
    const typed = Number(l.amount);
    return { line: l, amount: l.amount.trim() && typed > 0 ? typed : null };
  });
}

/** About how much a batch makes, in ml, rounded to 10; null when nothing says. */
export function prepYield(d: PrepDraft): number | null {
  let ml = 0;
  for (const { line: l, amount } of prepAmounts(d)) {
    if (amount === null) continue;
    ml += amount * (l.yieldPer ?? (l.unit === 'ml' ? 1 : 0));
  }
  return ml > 0 ? Math.round(ml / 10) * 10 : null;
}

/** "1 part", "2 parts", "2%" for the small ones, as the recipe step shows them. */
export function partsText(parts: number, baseParts: number): string {
  const share = parts / baseParts;
  if (share < 0.25) return `${Math.round(share * 1000) / 10}% of the base`;
  const v = Math.round(parts * 100) / 100;
  return `${v} ${v === 1 ? 'part' : 'parts'}`;
}

/** "Start 3 days ahead", "Start 1 hour ahead", from the lead time. */
export function leadText(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes >= 2 * DAY * 60) return `Start ${Math.round(minutes / (DAY * 60))} days ahead`;
  if (minutes >= DAY * 60) return 'Start a day ahead';
  if (minutes >= 120) return `Start ${Math.round(minutes / 60)} hours ahead`;
  if (minutes >= 60) return 'Start an hour ahead';
  return `Takes ${minutes} min`;
}

/** What a library technique says about its batch (lib/techniques Technique, structurally). */
export interface TechniqueBatch {
  id: string;
  base?: { name: string; unit: 'g' | 'ml'; amounts: number[] };
  parts?: { name: string; per: number; unit: 'g' | 'ml' | 'drops' }[];
}

/**
 * A new prep started from a library technique: its base and parts become the
 * recipe (at its usual batch), its steps the method. Steps are given without
 * the technique card's opening "For 400 g …" line, since the recipe says it.
 */
export function prepFromTechnique(t: TechniqueBatch, name: string, card: { steps: PrepDraftStep[]; leadMinutes: number; actions: string[] }): PrepDraft {
  const blank = startPrep('other', name);
  if (!t.base) return { ...blank, steps: card.steps, leadMinutes: card.leadMinutes, actions: card.actions, technique: t.id };
  const base = line(t.base.name, 1, t.base.unit, t.base.unit === 'ml' ? 1 : 0);
  const parts = (t.parts ?? []).map((p) => (p.unit === 'drops' ? line(p.name, null, 'drops', 0) : line(p.name, p.per, p.unit, p.unit === 'ml' ? 1 : 0)));
  return {
    ...blank,
    baseKey: base.key,
    baseAmount: t.base.amounts[Math.min(1, t.base.amounts.length - 1)] ?? 100,
    lines: [base, ...parts],
    steps: t.parts?.length ? card.steps.slice(1) : card.steps,
    leadMinutes: card.leadMinutes,
    actions: card.actions,
    technique: t.id,
  };
}
