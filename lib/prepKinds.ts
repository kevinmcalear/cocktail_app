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
import { asLike, keepFor, nameParts, partsFor, prepFacts, slotIngredient, splitName } from './techniques/template';
import { techniqueById } from './techniques';
import type { Technique } from './techniques/types';

/** 'batch' is a drink's pours bottled ahead (lib/batchLines): where combining two lines starts. 'wash' is a fat or milk wash; 'clarified' and 'distillate' are made one of the library's clarifying or distilling ways. */
export type PrepKindId = 'syrup' | 'rich' | 'shrub' | 'cordial' | 'oleo' | 'infusion' | 'super' | 'other' | 'batch' | 'wash' | 'clarified' | 'distillate';

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
  /** How it goes in ("Sliced, seeds in for more heat"): saved as the line's preparation note. */
  note?: string;
}

export interface PrepDraftStep {
  body: string;
  timer_seconds: number | null;
}

export interface PrepDraft {
  kind: PrepKindId;
  /** Shrubs: made cold (days, brighter) or hot (an hour, jammier). */
  hot?: boolean;
  /** The kind's way it's made (KIND_WAYS): a shrub cold, hot or as an oleo shrub. */
  way?: string;
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
  /** From the line names (lib/techniques/template prepFacts), or set by hand: keys from lib/allergens. */
  allergens?: Allergen[];
  /** The maker set the allergens themselves: kept as they are, and saved as checked. */
  allergensSet?: boolean;
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
  { id: 'batch', name: 'Batch', ratio: 'The drink’s pours, bottled ahead' },
  { id: 'syrup', name: 'Syrup', ratio: 'Sugar and water' },
  { id: 'rich', name: 'Rich syrup', ratio: 'Sugar and water, 2 : 1' },
  { id: 'shrub', name: 'Shrub', ratio: 'Fruit, sugar, vinegar' },
  { id: 'cordial', name: 'Cordial', ratio: 'Juice, sugar, acid' },
  { id: 'oleo', name: 'Oleo saccharum', ratio: 'Peels and sugar' },
  { id: 'infusion', name: 'Infusion', ratio: 'A spirit plus a flavour' },
  { id: 'wash', name: 'Wash', ratio: 'Fat, milk or butter' },
  { id: 'clarified', name: 'Clarified', ratio: 'Agar, centrifuge, milk' },
  { id: 'distillate', name: 'Distillate', ratio: 'Rotovap, hydrosols' },
  { id: 'super', name: 'Super juice', ratio: 'Peels, acids, water' },
  { id: 'other', name: 'Something else', ratio: 'Every technique, or write your own' },
];

/** What is it, as the board draws it (make-anything-steps-1, step 4): rich syrup and oleo saccharum are ways of a syrup. */
export const KIND_TILES: PrepKindId[] = ['batch', 'infusion', 'syrup', 'cordial', 'shrub', 'wash', 'clarified', 'distillate', 'super', 'other'];

/** The tile a kind is picked under: a rich syrup is a syrup. */
export const tileOf = (kind: PrepKindId): PrepKindId => (kind === 'rich' || kind === 'oleo' ? 'syrup' : kind);

const DAY = 24;
const WEEK = 7 * DAY;
const KIND_WORDS: [RegExp, PrepKindId][] = [
  [/\bsuper\s*juice\b/i, 'super'],
  [/\brich\b.*\bsyrup\b|\b2\s*:\s*1\b/i, 'rich'],
  [/\bshrub\b/i, 'shrub'],
  [/\bcordial\b/i, 'cordial'],
  [/\boleo\b/i, 'oleo'],
  // Not tinctures or bitters: those are their own technique (strong spirit, kept a year). A house liqueur is a spirit with a flavour in it.
  [/\b(infused|infusion|liqueur)\b/i, 'infusion'],
  [/\bsyrup\b|\bgomme\b/i, 'syrup'],
  [/\bclarified\b/i, 'clarified'],
  [/\b(distillate|hydrosol)\b/i, 'distillate'],
  [/\bbatch\b/i, 'batch'],
];

/** One way to make a kind (a cold shrub), as "How?" lists them under the kinds. */
export interface PrepWay {
  id: string;
  name: string;
  /** Start to ready, in words: "3 days". */
  time: string;
  kit: string[];
  /** What it's like: "brighter fruit". */
  note?: string;
  /** When to pick it: "Best with citrus peel in it". */
  tip?: string;
  /** How it's made, in a sentence, for the amounts box. */
  how: string;
  /** The library technique whose sources grade it (lib/techniques). */
  technique: string;
  /** Picking it fills in the method from the technique (its steps, keep and kit), in these words: "seal, water bath, strain". */
  fills?: string;
  /** A way that is its own kind (a rich syrup under Syrup). */
  kind?: PrepKindId;
  /** Its row in How?, when the technique's own name doesn't fit ("Fat wash", not "Fat washing"). */
  label?: string;
  /** How it's said after a kind's name, when its name doesn't read there: "Infusion, tincture" says "a tincture". */
  words?: string;
}

const SYRUP_WAYS: PrepWay[] = [
  { id: 'simple', name: 'Simple', kind: 'syrup', time: '20 min', kit: ['Pan'], note: '1 : 1', how: 'Sugar dissolved in as much water, warm, never boiled.', technique: 'syrup-by-weight' },
  { id: 'rich', name: 'Rich', kind: 'rich', time: '20 min', kit: ['Pan'], note: '2 : 1, keeps longer', how: 'Twice the sugar to the water, warm, never boiled.', technique: 'syrup-by-weight' },
  { id: 'oleo', name: 'Oleo saccharum', kind: 'oleo', time: 'A few hours', kit: ['Muddler'], note: 'peels and sugar, no water', how: 'The peels are muddled with the sugar until their oil turns it to syrup.', technique: 'syrup-by-weight' },
];

export const KIND_WAYS: Partial<Record<PrepKindId, PrepWay[]>> = {
  shrub: [
    { id: 'cold', name: 'Cold', time: '3 days', kit: ['Jar', 'fine strainer'], note: 'brighter fruit', how: 'The sugar pulls the juice for a day in the fridge, then the vinegar goes in.', technique: 'shrub' },
    { id: 'hot', name: 'Hot', time: 'An hour', kit: ['Pot', 'fine strainer'], note: 'jammier', how: 'The fruit cooks down with the sugar, then the vinegar goes in once it’s cool.', technique: 'shrub' },
    { id: 'oleo', name: 'Oleo shrub', time: '2 days', kit: ['Jar', 'muddler'], tip: 'Best with citrus peel in it', how: 'The fruit and peel are muddled with the sugar until it turns to syrup, then the vinegar goes in.', technique: 'shrub' },
  ],
  // As the board draws them (make-anything-steps-1, step 4): days, hours or minutes, each one of the library's infusions.
  infusion: [
    { id: 'cold', name: 'Cold', time: 'Days', kit: [], note: 'a jar, then strain', how: 'It rests in a jar in the fridge, tasted every day, then it’s strained.', technique: 'cold-infusion', fills: 'a jar, rest, strain' },
    { id: 'sous-vide', name: 'Sous vide', time: 'Hours', kit: [], note: 'sealed bag in a water bath, then strain', how: 'It’s sealed in a bag and held in a water bath, then chilled and strained.', technique: 'sous-vide-infusion', fills: 'seal, water bath, strain' },
    { id: 'nitrous', name: 'Nitrous', time: 'Minutes', kit: [], note: 'a cream whipper', how: 'It’s charged in a cream whipper, vented fast, then strained.', technique: 'nitrous-infusion', fills: 'charge, rest, vent, strain' },
    // The rest of the library's infusions (make-anything-steps-1, step 4, more to it): How? lists each by its technique, your kit first.
    { id: 'oil', name: 'Oil', time: '1 day', kit: [], words: 'an infused oil', how: 'The herbs are blanched, blended hot into the oil, chilled fast and strained.', technique: 'infused-oil', fills: 'blanch, blend hot, chill, strain' },
    { id: 'vacuum', name: 'Vacuum', time: 'Minutes', kit: [], how: 'A chamber vacuum pushes the liquid into the fruit; serve the fruit or strain the liquid.', technique: 'vacuum-infusion', fills: 'seal at full vacuum, strain' },
    { id: 'microwave', name: 'Microwave', time: '3 min', kit: [], how: 'It’s heated a few minutes with the flavour in, cooled with the lid on, then strained.', technique: 'microwave-infusion', fills: 'heat, cool covered, strain' },
    { id: 'tincture', name: 'Tincture', time: '2 weeks', kit: [], words: 'a tincture', how: 'Dried botanicals steep in strong spirit for two weeks, then it’s strained into dropper bottles.', technique: 'tincture', fills: 'steep, shake, strain into droppers' },
  ],
  clarified: [
    { id: 'agar-freeze', name: 'Agar freeze-thaw', time: '1 to 2 days', kit: [], how: 'Set with agar, frozen, then thawed through a cloth.', technique: 'agar-freeze-thaw', fills: 'set with agar, freeze, thaw through a cloth' },
    { id: 'gelatin', name: 'Gelatin freeze-thaw', time: '2 days', kit: [], how: 'Set with gelatin, frozen, then thawed through a cloth in the fridge.', technique: 'gelatin-freeze-thaw', fills: 'set with gelatin, freeze, thaw through a cloth' },
    { id: 'agar-quick', name: 'Quick agar', time: '30 min', kit: [], how: 'Agar set into it, broken up, then drained through a cloth.', technique: 'agar-quick', fills: 'set with agar, break up, drain' },
    { id: 'centrifuge', name: 'Centrifuge', time: 'Under 1 hour', kit: [], how: 'Enzymes, then a spin, then poured off clear.', technique: 'centrifuge', fills: 'enzymes, rest, spin, pour off' },
  ],
  distillate: [
    { id: 'rotovap', name: 'Rotary evaporation', time: 'Hours', kit: [], how: 'Distilled under vacuum at low heat, so the fresh flavour comes over.', technique: 'rotovap', fills: 'its specialist notes' },
  ],
  wash: [
    { id: 'fat', name: 'Fat', label: 'Fat wash', time: 'Overnight', kit: [], note: 'butter, bacon or an oil, frozen off', how: 'The fat sits in the spirit, then it’s frozen and lifted off.', technique: 'fat-wash', fills: 'mix, rest, freeze, strain' },
    { id: 'milk', name: 'Milk', label: 'Milk wash', time: 'Overnight', kit: [], note: 'the curds filter it clear', how: 'Milk curdles in it, and the curds filter it clear.', technique: 'milk-wash', fills: 'curdle, rest, filter' },
    { id: 'vegan', name: 'Vegan', label: 'Vegan wash', time: 'A weekend', kit: [], note: 'coconut or soy milk', how: 'A plant milk curdles in it and filters it clear.', technique: 'vegan-wash', fills: 'curdle, rest, filter' },
  ],
  syrup: SYRUP_WAYS,
  rich: SYRUP_WAYS,
  oleo: SYRUP_WAYS,
};

/** Kinds whose ways are the library's techniques, each with its own parts: picking the kind starts from one. */
export const FROM_TECHNIQUE: PrepKindId[] = ['wash', 'clarified', 'distillate'];

/**
 * A kind's ways that come from the library, the ones the kit covers first
 * (make-anything-steps-1, step 4, more to it), each in its own order:
 * nothing is hidden, the rest just follow. Syrups' and shrubs' ways are
 * recipes, not techniques, and come back as they are under `have`.
 */
export function waysByKit(kind: PrepKindId, kit: ReadonlySet<string>): { have: PrepWay[]; need: PrepWay[] } {
  const ways = KIND_WAYS[kind] ?? [];
  if (!ways.every((w) => w.fills)) return { have: ways, need: [] };
  const covered = (w: PrepWay) => (techniqueById(w.technique)?.equipment ?? []).every((id) => kit.has(id));
  return { have: ways.filter(covered), need: ways.filter((w) => !covered(w)) };
}

/** The way a kind starts as: the first the kit covers, else its first. */
export function kitFirstWay(kind: PrepKindId, kit: ReadonlySet<string>): PrepWay | undefined {
  const { have, need } = waysByKit(kind, kit);
  return have[0] ?? need[0];
}

/** The way a draft is made, when its kind has ways: a shrub or an infusion without one is cold. */
export function wayOf(d: Pick<PrepDraft, 'kind' | 'way' | 'hot' | 'technique'>): PrepWay | null {
  const ways = KIND_WAYS[d.kind];
  if (!ways) return null;
  if (ways[0].kind) return ways.find((w) => w.kind === d.kind) ?? null;
  return ways.find((w) => w.id === (d.way ?? (d.hot ? 'hot' : 'cold'))) ?? ways[0];
}

/** The kind and way a library technique is ("sous-vide-infusion" is an infusion, sous vide); null when no way fills from it. */
export function kindOfTechnique(id: string): { kind: PrepKindId; way: string } | null {
  for (const [kind, ways] of Object.entries(KIND_WAYS) as [PrepKindId, PrepWay[]][]) {
    const w = ways.find((x) => x.fills && x.technique === id);
    if (w) return { kind, way: w.id };
  }
  return null;
}

/** "a cold shrub", "a sous vide infusion", "a rich syrup", "an oleo shrub"; null for something else. */
export function prepPhrase(d: Pick<PrepDraft, 'kind' | 'way' | 'hot' | 'technique'>): string | null {
  const way = wayOf(d);
  if ((d.technique && !way) || d.kind === 'other') return null;
  const kind = PREP_KINDS.find((k) => k.id === d.kind)?.name.toLowerCase() ?? '';
  if (way?.words) return way.words;
  const words = way && !way.kind ? (way.id === 'oleo' ? way.name.toLowerCase() : `${way.name.toLowerCase()} ${kind}`) : kind;
  return `${/^[aeiou]/.test(words) ? 'an' : 'a'} ${words}`;
}

/** Under a house prep's line in the drink (make-anything-steps-2, step 7): "Infusion, sous vide · Tempus Fugit, red miso · 4 steps". */
export function prepSummary(d: PrepDraft, techniqueName?: string | null): string {
  const way = wayOf(d);
  const kind = PREP_KINDS.find((k) => k.id === d.kind)?.name;
  const head = d.kind === 'other' ? (techniqueName ?? null) : way && !way.kind ? `${kind}, ${way.name.toLowerCase()}` : kind;
  const names = d.lines.filter((l) => !l.slot && l.name.trim()).map((l, i) => (i ? l.name.toLowerCase() : l.name));
  const steps = d.steps.length ? `${d.steps.length} ${d.steps.length === 1 ? 'step' : 'steps'}` : null;
  return [head, names.join(', ') || null, steps].filter(Boolean).join(' · ');
}

/**
 * The recipe step's eyebrow: the kind and its way, and the ratio when it's
 * plain ("Shrub, cold · equal parts by weight"); null for a technique or
 * something else (the name shows instead).
 */
export function recipeEyebrow(d: PrepDraft): string | null {
  const way = wayOf(d);
  if ((d.technique && !way) || d.kind === 'other') return null;
  const kind = PREP_KINDS.find((k) => k.id === d.kind)?.name ?? '';
  const head = way && !way.kind ? (way.id === 'oleo' ? way.name : `${kind}, ${way.name.toLowerCase()}`) : kind;
  const parted = d.lines.filter((l) => l.parts !== null && !l.slot);
  const equal = parted.length > 1 && parted.every((l) => l.parts === parted[0].parts && l.unit === parted[0].unit);
  const by = parted[0]?.unit === 'g' ? 'by weight' : parted[0]?.unit === 'ml' ? 'by volume' : null;
  return equal && by ? `${head} · equal parts ${by}` : head;
}

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

/**
 * Extra flavours a name gives that have a usual amount, so the recipe starts
 * with one (make-create-prep-recipe: "Fresno chili, 2 whole, sliced").
 * ponytail: only the chili the canvas draws; anything else starts to taste.
 * Add a row here when a board draws another.
 */
const EXTRA_STARTS: { re: RegExp; name: string; amount: string; unit: string; note: string }[] = [
  { re: /^chil+[ie](e?s)?$/i, name: 'Fresno chili', amount: '2', unit: 'whole', note: 'Sliced, seeds in for more heat' },
];

/** An extra flavour's line: its usual amount when known, else to taste. */
function extraLine(word: string): PrepDraftLine {
  const known = EXTRA_STARTS.find((e) => e.re.test(word.trim()));
  return known ? { ...line(known.name, null, known.unit, 0, known.amount), note: known.note } : line(word, null, '', 0);
}

/** Where it's kept, as the method step's chips say it. */
export const STORES = ['Fridge, sealed bottle', 'Freezer', 'Ambient, dark', 'Airtight, dry'] as const;
const STORE_TEXT: Record<string, (typeof STORES)[number]> = { fridge: STORES[0], freezer: STORES[1], ambient: STORES[2], airtight: STORES[3] };

/**
 * A new prep's draft from a kind and its name: the kind's parts with the
 * name's flavour as the base, its method, keeps and lead time.
 */
export function startPrep(kind: PrepKindId, name: string, way?: string): PrepDraft {
  const [flavour = '', ...extra] = flavourWords(name);
  const extras = extra.map(extraLine);
  const shrubWay = kind === 'shrub' ? (way ?? 'cold') : undefined;
  const hot = shrubWay === 'hot';
  const draft = (lines: PrepDraftLine[], baseAmount: number, steps: PrepDraftStep[], keepsHours: number | null, storage: string, leadMinutes: number | null, actions: string[]): PrepDraft =>
    withFacts({ kind, hot: kind === 'shrub' ? hot : undefined, way: shrubWay ?? way, baseKey: lines[0].key, baseAmount, lines, steps, keepsHours, storage, leadMinutes, actions });
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
      return draft([flavour ? line(flavour, 1, 'g', 0.6) : slotLine('Fruit', 'fruit', 1, 'g', 0.6), line('White sugar', 1, 'g', 0.62), line('Apple cider vinegar', 1, 'g', 1), ...extras], 300, shrubWay === 'oleo'
        ? [
            s('Muddle the fruit, and any citrus peel, with the sugar.'),
            s('Cover and leave at room temperature until the sugar has turned to syrup.', DAY * 3600),
            s('Strain, pressing hard. Scrape in any sugar left behind.'),
            s('Stir in the vinegar, bottle and rest in the fridge for a day before using.'),
          ]
        : hot
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
            s('Bottle and rest in the fridge before using.', 2 * DAY * 3600),
          ], 3 * WEEK, fridge, hot ? 60 : shrubWay === 'oleo' ? 2 * DAY * 60 : 3 * DAY * 60, ['Infuse', 'Strain']); // 3 to 6 weeks if opened often: the shorter.
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
    case 'batch':
    case 'wash':
    case 'clarified':
    case 'distillate':
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
  // A batch fills its bottle exactly, so 60 ml of it costs what the drink's own pours do.
  if (ml > 0 && d.kind === 'batch') return Math.round(ml);
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
  // Allergens set by hand stay as they were set.
  return { ...d, allergens: d.allergensSet ? d.allergens : facts.allergens, contains: facts.contains, vegan: facts.vegan };
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
  const finish = (lines: PrepDraftLine[], baseKey: string, baseAmount: number, steps: PrepDraftStep[]): PrepDraft =>
    withFacts({
      ...blank,
      // A wash or an infusion the kinds list: picked under its kind, with its way lit.
      ...kindOfTechnique(t.id),
      baseKey,
      baseAmount,
      lines,
      ...techniqueMethod(t, { ...card, steps }, { adjunct: adjunct?.name ?? null, name }),
      madeFrom: picked.base ? { id: picked.base.id ?? null, name: picked.base.name } : null,
    });
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
    // A picked ingredient is used as is; a word from the name becomes the catalog thing it means in this slot (coconut → Coconut Oil).
    const fill = p.slot && adjunct && !p.name.toLowerCase().includes(adjunct.name.toLowerCase()) ? (picked.adjunct ? adjunct.name : (slotIngredient(p.slot, adjunct.name) ?? asLike(adjunct.name, p.name))) : null;
    if (p.slot) usedAdjunct = true;
    const l = p.unit === 'drops' ? line(fill ?? p.name, null, 'drops', 0) : line(fill ?? p.name, p.per, p.unit, yieldPer(p.name, p.unit, p.removed));
    if (fill) l.id = picked.adjunct?.id ?? null;
    if (p.generic && !fill) l.slot = p.slot ?? p.name.toLowerCase();
    if (p.removed) l.removed = true;
    lines.push(l);
  }
  if (t.withWhat && !usedAdjunct) {
    if (adjunct) lines.push({ ...line(picked.adjunct ? adjunct.name : (slotIngredient(t.withWhat, adjunct.name) ?? adjunct.name), null, 'g', 0), id: adjunct.id ?? null });
    else if (needsWith(t)) lines.push(slotLine(WITH_STAND_IN[t.withWhat] ?? 'Flavour', t.withWhat, null, 'g', 0));
  }
  const extra = (t.extra ?? []).map((e) => ({ ...line(e.name, null, '', 0), ...(e.removed ? { removed: true } : null) }));
  for (const w of named.extra) lines.push(line(w, null, '', 0));
  // With no base (orgeat, kombucha), what it's made of leads and the flavour follows.
  const all = base ? [base, ...lines, ...extra] : [...extra, ...lines];
  if (!all.length) all.push(...blank.lines);
  // The card's first step gives the usual batch's amounts ("For 750 ml spirit: 60 ml melted fat."), as the canvas keeps it.
  return finish(all, all[0].key, t.base ? (t.base.amounts[Math.min(1, t.base.amounts.length - 1)] ?? 100) : 100, card.steps);
}

/** The steps a library technique gives, its lead time and its tags (lib/techniques/makeIt prepCardFor, structurally). */
export type TechniqueCard = { steps: PrepDraftStep[]; leadMinutes: number; actions: string[] };

/** How a library technique says it's made: its steps, keep, storage, lead time, kit and safety notes. */
export function techniqueMethod(t: TechniqueBatch, card: TechniqueCard, picked: { adjunct?: string | null; name?: string } = {}) {
  const keep = keepFor(t, picked);
  const minutes = keep.hours !== null && keep.hours < 1 ? Math.round(keep.hours * 60) : null;
  return {
    steps: card.steps,
    keepsHours: minutes ? null : keep.hours,
    keepsMinutes: minutes,
    storage: keep.storage ? STORE_TEXT[keep.storage] : STORES[0],
    leadMinutes: card.leadMinutes,
    actions: card.actions,
    technique: t.id,
    equipment: t.equipment ?? [],
    gate: t.gate,
    watch: t.watch,
  } satisfies Partial<PrepDraft>;
}

/** A way picked that fills in the method (an infusion, sous vide): what goes in stays, how it's made comes from the technique. */
export function withMethod(d: PrepDraft, t: TechniqueBatch, card: TechniqueCard, way: string): PrepDraft {
  return withFacts({ ...d, way, ...techniqueMethod(t, card) });
}

/** A kind picked for lines that were combined: the kind's method and keep, with the lines as they were. */
export function keepLines(fresh: PrepDraft, from: PrepDraft): PrepDraft {
  return withFacts({ ...fresh, lines: from.lines, baseKey: from.baseKey, baseAmount: from.baseAmount, madeFrom: from.madeFrom });
}

/** Units a line of a recipe is measured in, as it goes in (make-anything-steps-2, step 5). */
export const MEASURE_UNITS = ['ml', 'g', 'kg', 'tsp', 'tbsp', 'bsp', 'dash', 'drop', 'each', 'pinch'] as const;

/** A shared catalog recipe, as useCatalogRecipe reads it (structurally). */
export interface CatalogRecipeLike {
  lines: { id: string | null; name: string; amount: number | null; unit: string | null; note: string | null; optional: boolean }[];
  card: {
    prep: { shelf_life_hours: number | null; lead_time_minutes: number | null; storage: string | null; actions: string[] } | null;
    steps: { body: string; timer_seconds: number | null }[];
  };
}

/**
 * A new house version that starts from the catalog's recipe: its lines as
 * parts of the first weighed or measured line (others keep their own amount),
 * its steps, keep, storage and tags. The maker changes what they like.
 */
export function prepFromCatalog(name: string, recipe: CatalogRecipeLike): PrepDraft {
  const base = recipe.lines.find((l) => l.amount != null && l.amount > 0 && (l.unit === 'g' || l.unit === 'ml')) ?? null;
  const lines: PrepDraftLine[] = recipe.lines.map((l) => {
    const sameUnit = !!base && l.amount != null && l.amount > 0 && l.unit === base.unit;
    return {
      key: key(),
      id: l.id,
      name: l.name,
      parts: sameUnit ? Math.round((l.amount! / base!.amount!) * 1000) / 1000 : null,
      unit: l.unit ?? base?.unit ?? 'g',
      amount: sameUnit || l.amount == null ? '' : String(l.amount),
      ...(l.note ? { note: l.note } : {}),
    };
  });
  const prep = recipe.card.prep;
  return withFacts({
    kind: guessKind(name) ?? 'other',
    baseKey: lines[base ? recipe.lines.indexOf(base) : 0]?.key ?? '',
    baseAmount: base?.amount ?? 100,
    lines,
    steps: recipe.card.steps.map((s) => ({ body: s.body, timer_seconds: s.timer_seconds })),
    keepsHours: prep?.shelf_life_hours ?? null,
    storage: prep?.storage ?? 'Fridge, sealed bottle',
    leadMinutes: prep?.lead_time_minutes ?? null,
    actions: prep?.actions ?? [],
  });
}

/** "https://www.imbibemagazine.com/recipe/x" → "imbibemagazine.com": a source as people say it. */
export function sourceSite(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, '').split(/[/?#]/)[0];
}
