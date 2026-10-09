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
 * Keeps are always the safer number when sources differ.
 */
import type { Allergen } from './allergens';
import { asLike, keepFor, nameParts, partsFor, prepFacts, splitName } from './techniques/template';
import type { Technique } from './techniques/types';

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
  /**
   * A stand-in still to fill ("Spirit", "Melted fat"): what to pick, "spirit"
   * or "fat". Never saved: the builder won't finish until it's picked or removed.
   */
  slot?: string;
  /** Lifted off or strained out (the fat cap, the curds): not in what it makes. */
  removed?: boolean;
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
  /** A keep under an hour (an air: 5 min), when keepsHours is null. */
  keepsMinutes?: number | null;
  storage: string;
  /** How far ahead to start it. */
  leadMinutes: number | null;
  actions: string[];
  /** A technique from the library (lib/techniques) it was started from. */
  technique?: string;
  /** The bottle or ingredient it changes, when one was picked (for made_from_id). */
  madeFrom?: { id: string | null; name: string } | null;
  /** From the line names (lib/techniques/template prepFacts): keys from lib/allergens. */
  allergens?: Allergen[];
  /** Diet flags outside the 14 allergens: "Pork". */
  contains?: string[];
  /** null while a line is still a stand-in. */
  vegan?: boolean | null;
  /** Equipment ids it can't be made without. */
  equipment?: string[];
  /** Shown before the method: real injury risk, or the law. */
  gate?: 'safety' | 'legal';
  /** Safety and the ways it goes wrong. */
  watch?: string[];
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
  { id: 'cordial', name: 'Cordial', ratio: 'Juice, sugar, citric acid, no heat' },
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
  // Not tinctures or bitters: those are their own technique (strong spirit, kept a year).
  [/\b(infused|infusion)\b/i, 'infusion'],
  [/\bsyrup\b|\bgomme\b/i, 'syrup'],
];

/** The kind a name says it is ("Pineapple chili shrub" is a shrub), or null. */
export function guessKind(name: string): PrepKindId | null {
  return KIND_WORDS.find(([re]) => re.test(name))?.[1] ?? null;
}

/**
 * "Pineapple chili shrub" → ["Pineapple", "Chili"]: the flavour words,
 * without the kind's or a technique's ("fat washed", "infused", "oil"). What
 * follows a technique word is one thing: "coconut fat washed white rum" is
 * ["Coconut", "White rum"].
 */
export function flavourWords(name: string): string[] {
  const { before, after } = splitName(name.replace(/\b2\s*:\s*1\b/g, ' '));
  const cap = (w: string) => w[0].toUpperCase() + w.slice(1);
  return [...before.map(cap), ...(after.length ? [cap(after.join(' '))] : [])];
}

let n = 0;
const key = () => `p${Date.now().toString(36)}${(n++).toString(36)}`;
const line = (name: string, parts: number | null, unit: string, yieldPer?: number, amount = ''): PrepDraftLine => ({ key: key(), id: null, name, parts, unit, amount, yieldPer });
const slotLine = (name: string, slot: string, parts: number | null, unit: string, yieldPer?: number): PrepDraftLine => ({ ...line(name, parts, unit, yieldPer), slot });

/** Where it's kept, as the method step's chips say it. */
export const STORES = ['Fridge, sealed bottle', 'Freezer', 'Ambient, dark', 'Airtight, dry'] as const;
const STORE_TEXT: Record<string, (typeof STORES)[number]> = { fridge: STORES[0], freezer: STORES[1], ambient: STORES[2], airtight: STORES[3] };

/**
 * A new prep's draft from a kind and its name: the kind's parts with the
 * name's flavour as the base, its method, keeps and lead time.
 */
export function startPrep(kind: PrepKindId, name: string, hot = false): PrepDraft {
  const [flavour = '', ...extra] = flavourWords(name);
  const extras = extra.map((w) => line(w, null, '', 0));
  const draft = (lines: PrepDraftLine[], baseAmount: number, steps: PrepDraftStep[], keepsHours: number | null, storage: string, leadMinutes: number | null, actions: string[]): PrepDraft =>
    withFacts({ kind, hot: kind === 'shrub' ? hot : undefined, baseKey: lines[0].key, baseAmount, lines, steps, keepsHours, storage, leadMinutes, actions });
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
      return draft([flavour ? line(flavour, 1, 'g', 0.6) : slotLine('Fruit', 'fruit', 1, 'g', 0.6), line('Sugar', 1, 'g', 0.62), line('Apple cider vinegar', 1, 'g', 1), ...extras], 300, hot
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
          ], 3 * WEEK, fridge, hot ? 60 : 3 * DAY * 60, ['Infuse', 'Strain']); // 3 to 6 weeks if opened often: the shorter.
    case 'cordial':
      return draft([flavour ? line(`${flavour} juice`, 1, 'g', 1) : slotLine('Juice', 'juice', 1, 'g', 1), line('Sugar', 1, 'g', 0.62), line('Citric acid', 0.02, 'g', 0), ...extras], 500, [
        s('Stir the sugar and citric acid into the juice until they dissolve. No heat.'),
        s('Bottle and keep cold.'),
      ], 2 * WEEK, fridge, 15, ['Mix']);
    case 'oleo':
      return draft([line(flavour ? `${flavour} peels` : 'Citrus peels', 1, 'g', 0.3), line('Sugar', 1, 'g', 0.62), ...extras], 200, [
        s('Muddle the peels with the sugar.'),
        s('Cover and leave at room temperature until the sugar is wet.', 4 * 3600),
        s('Stir, then strain, pressing the peels.'),
      ], 2 * WEEK, fridge, 5 * 60, ['Infuse', 'Strain']);
    case 'infusion': {
      // The spirit the name gives ("Chamomile infused gin"), or one to pick.
      const named = nameParts(name, { starts: 'spirit', withWhat: 'flavour' });
      const spirit = named.base ? line(named.base, 1, 'ml', 0.95) : slotLine('Spirit', 'spirit', 1, 'ml', 0.95);
      const with_ = named.adjunct ? line(named.adjunct, 0.1, 'g', 0) : slotLine('Flavour', 'flavour', 0.1, 'g', 0);
      // ponytail: no source gives a keep for an infused spirit; 2 weeks cold is
      // the fat wash's (the shortest sourced keep for a strained spirit). Fresh
      // fruit or dairy in it could be less: the maker sets the real one.
      return draft([spirit, with_], 700, [
        s('Add the flavour to the spirit in a clean jar.'),
        s('Leave to infuse, tasting now and then.', DAY * 3600),
        s('Strain and bottle.'),
      ], 2 * WEEK, fridge, DAY * 60, ['Infuse', 'Strain']);
    }
    case 'super':
      return draft([line(flavour ? `${flavour} peels` : 'Lime peels', 1, 'g', 0.3), line('Citric acid', 0.66, 'g', 0.6), line('Malic acid', 0.33, 'g', 0.6), line('Water', 16.67, 'ml', 1)], 60, [
        s('Cover the peels with the acids and leave them to draw.', 3600),
        s('Add the water and blend until smooth.'),
        s('Strain through a fine cloth, bottle and keep cold.'),
      ], 3 * DAY, fridge, 90, ['Blend', 'Strain']);
    case 'other':
      return draft([flavour ? line(flavour, 1, 'g') : slotLine('Main ingredient', 'main ingredient', 1, 'g'), ...extras], 100, [], null, fridge, null, []);
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
    if (amount === null || l.removed) continue;
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

/** "5 min", "4 days", "2 weeks", "1 year": how long a draft keeps, in words. */
export function keepsText(d: Pick<PrepDraft, 'keepsHours' | 'keepsMinutes'>): string | null {
  const DAYS = 24;
  if (d.keepsMinutes) return `${d.keepsMinutes} min`;
  const h = d.keepsHours;
  if (!h || h <= 0) return null;
  if (h % (365 * DAYS) === 0) return h === 365 * DAYS ? '1 year' : `${h / (365 * DAYS)} years`;
  if (h % WEEK === 0 && h >= 2 * WEEK) return `${h / WEEK} weeks`;
  if (h % DAYS === 0 && h >= 2 * DAYS) return `${h / DAYS} days`;
  if (h === DAYS) return '1 day';
  return `${h} ${h === 1 ? 'hour' : 'hours'}`;
}

/** Lines still a stand-in ("Spirit"): the builder won't finish until each is picked or removed. */
export function openSlots(d: Pick<PrepDraft, 'lines'>): PrepDraftLine[] {
  return d.lines.filter((l) => l.slot);
}

/** "Pick the spirit, or take it out, to go on." for the first open slot; null when none. */
export function slotMessage(d: Pick<PrepDraft, 'lines'>): string | null {
  const [first, ...more] = openSlots(d);
  if (!first) return null;
  return more.length ? `Pick the ${first.slot} and the ${more.map((l) => l.slot).join(' and the ')}, or take them out, to go on.` : `Pick the ${first.slot}, or take it out, to go on.`;
}

/** Allergens and vegan, read again from the lines as they are now (a line swapped or added). */
export function withFacts<D extends PrepDraft>(d: D): D {
  const facts = prepFacts(d.lines.filter((l) => !l.slot).map((l) => l.name), d.lines.some((l) => l.slot));
  return { ...d, allergens: facts.allergens, contains: facts.contains, vegan: facts.vegan };
}

/** What a library technique says about its batch (lib/techniques Technique, structurally). */
export type TechniqueBatch = { id: string } & Partial<Pick<Technique, 'base' | 'parts' | 'extra' | 'starts' | 'withWhat' | 'keepsHours' | 'storage' | 'variants' | 'equipment' | 'gate' | 'watch'>>;

/** A bottle or ingredient picked for the base, or for the "with what". */
export interface PrepPick {
  id?: string | null;
  name: string;
}

/** What a stand-in for each kind of base is called. */
const STAND_IN: Record<string, { name: string; slot: string; unit: string }> = {
  spirit: { name: 'Spirit', slot: 'spirit', unit: 'ml' },
  wine: { name: 'Wine', slot: 'wine', unit: 'ml' },
  juice: { name: 'Juice', slot: 'juice', unit: 'ml' },
  produce: { name: 'Fruit or vegetables', slot: 'fruit or vegetables', unit: 'g' },
  liquid: { name: 'Liquid', slot: 'liquid', unit: 'ml' },
  // Water and sugar are what they say: never a stand-in.
  water: { name: 'Water', slot: '', unit: 'ml' },
  sugar: { name: 'Sugar', slot: '', unit: 'g' },
  fat: { name: 'Fat', slot: 'fat', unit: 'g' },
};
/** A "with what" nobody named: a stand-in when it can't be left out (an infusion needs something in it). */
const WITH_STAND_IN: Record<string, string> = { fat: 'Fat', milk: 'Milk', botanical: 'Botanicals', herb: 'Herbs', spirit: 'Spirit', flavour: 'Flavour' };
const needsWith = (t: TechniqueBatch) => !!t.withWhat && (t.withWhat !== 'flavour' && t.withWhat !== 'wood' ? true : ['spirit', 'wine', 'produce'].includes(t.starts ?? ''));

/** ml a gram or ml of a line adds to the batch, for "Makes about". */
function yieldPer(name: string, unit: string, removed?: boolean): number {
  if (removed) return 0;
  if (unit === 'ml') return 1;
  if (unit !== 'g') return 0;
  if (/\b(water|juice|vinegar|milk|syrup|spirit|wine|liquid|batch)\b/i.test(name)) return 1;
  if (/\b(sugar|piloncillo)\b/i.test(name)) return 0.62;
  return 0;
}

/**
 * A new prep started from a library technique: its base and parts become the
 * recipe (at its usual batch), its steps the method, with its keep, storage,
 * allergens, equipment and safety notes. The base is the bottle picked, or
 * what the name says ("coconut fat washed white rum": White rum, with
 * Coconut as the fat), or a stand-in to pick before it can be saved. Steps
 * are given without the technique card's opening "For 400 g …" line, since
 * the recipe says it.
 */
export function prepFromTechnique(
  t: TechniqueBatch,
  name: string,
  card: { steps: PrepDraftStep[]; leadMinutes: number; actions: string[] },
  picked: { base?: PrepPick | null; adjunct?: PrepPick | null } = {},
): PrepDraft {
  const blank = startPrep('other', name);
  const finish = (lines: PrepDraftLine[], baseKey: string, baseAmount: number, steps: PrepDraftStep[]): PrepDraft => {
    const keep = keepFor(t, { adjunct: adjunct?.name ?? null, name });
    const minutes = keep.hours !== null && keep.hours < 1 ? Math.round(keep.hours * 60) : null;
    return withFacts({
      ...blank,
      baseKey,
      baseAmount,
      lines,
      steps,
      keepsHours: minutes ? null : keep.hours,
      keepsMinutes: minutes,
      storage: keep.storage ? STORE_TEXT[keep.storage] : blank.storage,
      leadMinutes: card.leadMinutes,
      actions: card.actions,
      technique: t.id,
      madeFrom: picked.base ? { id: picked.base.id ?? null, name: picked.base.name } : null,
      equipment: t.equipment ?? [],
      gate: t.gate,
      watch: t.watch,
    });
  };
  const named = t.starts ? nameParts(name, t) : { base: null, adjunct: null, extra: [] };
  const adjunct: PrepPick | null = picked.adjunct ?? (named.adjunct ? { name: named.adjunct } : null);
  if (!t.base && !t.starts) return finish(blank.lines, blank.baseKey, blank.baseAmount, card.steps);

  const lines: PrepDraftLine[] = [];
  const baseText = picked.base?.name ?? named.base;
  let base: PrepDraftLine | null = null;
  if (t.base) {
    const filled = picked.base ? picked.base.name : baseText && t.base.slot ? asLike(baseText, t.base.name) : null;
    base = filled ? line(filled, 1, t.base.unit) : t.base.slot ? slotLine(t.base.name, t.base.name.toLowerCase(), 1, t.base.unit) : line(t.base.name, 1, t.base.unit);
    base.yieldPer = yieldPer(base.name, t.base.unit);
    if (!t.base.slot && baseText && !picked.base) lines.push(line(baseText, null, '', 0));
  } else if (t.starts && STAND_IN[t.starts]) {
    // No sourced batch: the base takes an amount of its own, typed in.
    const s = STAND_IN[t.starts];
    base = baseText || !s.slot ? line(baseText ?? s.name, null, s.unit, yieldPer(baseText ?? s.name, s.unit)) : slotLine(s.name, s.slot, null, s.unit, yieldPer(s.name, s.unit));
  }
  if (base) base.id = picked.base?.id ?? null;

  let usedAdjunct = false;
  for (const p of partsFor(t, { adjunct: adjunct?.name ?? null, name })) {
    const fill = p.slot && adjunct && !p.name.toLowerCase().includes(adjunct.name.toLowerCase()) ? asLike(adjunct.name, p.name) : null;
    if (p.slot) usedAdjunct = true;
    const l = p.unit === 'drops' ? line(fill ?? p.name, null, 'drops', 0) : line(fill ?? p.name, p.per, p.unit, yieldPer(p.name, p.unit, p.removed));
    if (fill) l.id = picked.adjunct?.id ?? null;
    if (p.generic && !fill) l.slot = p.slot ?? p.name.toLowerCase();
    if (p.removed) l.removed = true;
    lines.push(l);
  }
  if (t.withWhat && !usedAdjunct) {
    if (adjunct) lines.push({ ...line(adjunct.name, null, 'g', 0), id: adjunct.id ?? null });
    else if (needsWith(t)) lines.push(slotLine(WITH_STAND_IN[t.withWhat] ?? 'Flavour', t.withWhat, null, 'g', 0));
  }
  const extra = (t.extra ?? []).map((e) => ({ ...line(e.name, null, '', 0), ...(e.removed ? { removed: true } : null) }));
  for (const w of named.extra) lines.push(line(w, null, '', 0));
  // With no base (orgeat, kombucha), what it's made of leads and the flavour follows.
  const all = base ? [base, ...lines, ...extra] : [...extra, ...lines];
  if (!all.length) all.push(...blank.lines);
  const steps = t.base && t.parts?.length ? card.steps.slice(1) : card.steps;
  return finish(all, all[0].key, t.base ? (t.base.amounts[Math.min(1, t.base.amounts.length - 1)] ?? 100) : 100, steps);
}
