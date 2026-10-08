/**
 * The add-drink wizard's draft and its rules: one step per screen, a draft
 * that's plain JSON (it's kept in storage until the drink is saved), and the
 * quick choices each step offers. The screens are in
 * components/screens/addDrink; saving is hooks/useCreateDrink.ts.
 */
import type { DraftLook } from '@/lib/sketch/draft';
import type { PublishMode } from '@/lib/publishing';

export const WIZARD_STEPS = ['name', 'ingredients', 'method', 'glass', 'ice', 'garnish', 'credits', 'notes', 'publish', 'review'] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];
/** The steps the progress counts ("2 of 9"); the review after them isn't one. */
export const COUNTED_STEPS = WIZARD_STEPS.length - 1;

export const STEP_COPY: Record<WizardStep, { title: string; short: string; intro?: string; optional: boolean }> = {
  name: { title: 'What’s it called?', short: 'Name', optional: false },
  ingredients: { title: 'What goes in?', short: 'Ingredients', optional: true },
  method: { title: 'How’s it made?', short: 'Method', intro: 'One, or a few in order.', optional: true },
  glass: { title: 'What glass?', short: 'Glass', optional: true },
  ice: { title: 'What ice?', short: 'Ice', optional: true },
  garnish: { title: 'Any garnish?', short: 'Garnish', optional: true },
  credits: { title: 'Who made it?', short: 'Credits', optional: true },
  notes: { title: 'Anything to add?', short: 'Notes', optional: true },
  publish: { title: 'Who can see it?', short: 'Who sees it', optional: true },
  review: { title: 'Look right?', short: 'Review', optional: false },
};

/** An existing row (id) or one to create on save (id null). */
export interface WizardPick {
  id: string | null;
  name: string;
}

export interface WizardLine extends WizardPick {
  /** Stable while editing, so rows keep their keys and focus. */
  key: string;
  amount: string;
  unit: string;
}

export interface WizardDraft {
  name: string;
  lines: WizardLine[];
  /** In order: "Dry shake" then "Shake". */
  methods: WizardPick[];
  glass: WizardPick | null;
  /** How the glass is drawn ('martini_pony', lib/sketch/geometry.ts); null is the bar's glass or the default. Saved as items.sketch_variant. */
  glassVariant?: string | null;
  ice: WizardPick | null;
  /** Saved as spec lines with a count unit (peel, twist, wheel), the way specs already write them. */
  garnishes: WizardLine[];
  /** Your own profile ('me'), someone else's, or 'nobody'. Not chosen yet (null) means you, when you have a profile. */
  creator: 'me' | 'nobody' | WizardPick | null;
  /** Everyone else who made it with them (person profiles). */
  coCreators: WizardPick[];
  riffOf: WizardPick | null;
  description: string;
  notes: string;
  /** null follows the venue (or is private, for a drink at home). */
  publish: PublishMode | null;
}

export const EMPTY_DRAFT: WizardDraft = {
  name: '',
  lines: [],
  methods: [],
  glass: null,
  glassVariant: null,
  ice: null,
  garnishes: [],
  creator: null,
  coCreators: [],
  riffOf: null,
  description: '',
  notes: '',
  publish: null,
};

/** Whether a step has anything in it (an empty optional step offers Skip). */
export function stepFilled(step: WizardStep, d: WizardDraft): boolean {
  switch (step) {
    case 'name':
      return d.name.trim().length > 0;
    case 'ingredients':
      return d.lines.length > 0;
    case 'method':
      return d.methods.length > 0;
    case 'glass':
      return !!d.glass;
    case 'ice':
      return !!d.ice;
    case 'garnish':
      return d.garnishes.length > 0;
    case 'credits':
      return d.creator !== null || d.coCreators.length > 0 || !!d.riffOf;
    case 'notes':
      return !!(d.description.trim() || d.notes.trim());
    case 'publish':
      return d.publish !== null;
    case 'review':
      return true;
  }
}

/** The profile credited: yours unless you picked someone else or nobody. */
export function creatorProfileId(d: WizardDraft, myProfileId: string | null): string | null {
  if (d.creator === 'nobody') return null;
  if (d.creator === null || d.creator === 'me') return myProfileId;
  return d.creator.id;
}

/** Only the name is required: everything else can be skipped and added later. */
export const canSave = (d: WizardDraft) => d.name.trim().length > 0;

export const hasContent = (d: WizardDraft) => WIZARD_STEPS.some((s) => s !== 'review' && s !== 'publish' && stepFilled(s, d));

const norm = (s: string) => s.trim().toLowerCase();

/** A name as an ILIKE pattern that matches only itself (any case, spaces tidied). */
export const likeExactly = (name: string) => name.trim().replace(/\s+/g, ' ').replace(/[\\%_]/g, (c) => `\\${c}`);

/** The existing row with this name (any case), or a new one to create. */
export function pickByName<T extends { id: string; name: string | null }>(name: string, rows: readonly T[]): WizardPick {
  const hit = rows.find((r) => r.name && norm(r.name) === norm(name));
  return hit ? { id: hit.id, name: hit.name ?? name } : { id: null, name: name.trim() };
}

/**
 * The chips for a step: the common choices first (existing rows where we have
 * them, so nothing is duplicated), then every other row A to Z.
 */
export function choiceList<T extends { id: string; name: string | null }>(common: readonly string[], rows: readonly T[]): WizardPick[] {
  const seen = new Set<string>();
  const out: WizardPick[] = [];
  const add = (p: WizardPick) => {
    if (!p.name.trim() || seen.has(norm(p.name))) return;
    seen.add(norm(p.name));
    out.push(p);
  };
  for (const name of common) add(pickByName(name, rows));
  for (const r of [...rows].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))) if (r.name) add({ id: r.id, name: r.name });
  return out;
}

export const samePick = (a: WizardPick | null, b: WizardPick | null) => !!a && !!b && (a.id && b.id ? a.id === b.id : norm(a.name) === norm(b.name));

/** Ingredients matching what's typed: names that start with it first, then ones that contain it. */
export function searchByName<T extends { id: string; name: string | null }>(query: string, rows: readonly T[], limit = 6): T[] {
  const q = norm(query);
  if (!q) return [];
  const starts: T[] = [];
  const contains: T[] = [];
  for (const r of rows) {
    const n = norm(r.name ?? '');
    if (n.startsWith(q)) starts.push(r);
    else if (n.includes(q)) contains.push(r);
  }
  const byLength = (a: T, b: T) => (a.name ?? '').length - (b.name ?? '').length;
  return [...starts.sort(byLength), ...contains.sort(byLength)].slice(0, limit);
}

// --- quick choices ---

// Spirits and the things that go with them, mixed, so the first few cover most specs.
export const COMMON_INGREDIENTS = [
  'Gin', 'Lime juice', 'Lemon juice', 'Simple syrup', 'Sweet vermouth', 'Campari', 'Angostura bitters', 'Rye whiskey',
  'Bourbon', 'White rum', 'Tequila', 'Mezcal', 'Vodka', 'Dry vermouth', 'Soda water', 'Egg white',
] as const;
export const COMMON_METHODS = ['Shake', 'Stir', 'Build', 'Throw', 'Blend', 'Swizzle', 'Dry shake', 'Muddle'] as const;
export const COMMON_GLASSES = ['Coupe', 'Nick & Nora', 'Martini', 'Rocks', 'Highball', 'Collins', 'Flute', 'Wine', 'Julep cup', 'Mug', 'Tiki'] as const;
export const COMMON_ICE = ['No ice', 'Cubes', 'Large cube', 'Crushed', 'Pebble', 'Spear', 'Sphere'] as const;

/** A garnish chip: the spec line it adds. */
export interface GarnishChip {
  label: string;
  name: string;
  unit: string;
  amount: string;
}
const g = (label: string, name: string, unit: string, amount = '1'): GarnishChip => ({ label, name, unit, amount });
export const GARNISH_CHIPS: readonly GarnishChip[] = [
  g('Orange peel', 'Orange', 'peel'),
  g('Lemon twist', 'Lemon', 'twist'),
  g('Grapefruit peel', 'Grapefruit', 'peel'),
  g('Lime wheel', 'Lime', 'wheel'),
  g('Lime wedge', 'Lime', 'wedge'),
  g('Lemon wheel', 'Lemon', 'wheel'),
  g('Orange wheel', 'Orange', 'wheel'),
  g('Cherry', 'Cocktail cherry', 'each'),
  g('Olive', 'Olive', 'each'),
  g('Mint sprig', 'Mint', 'sprig'),
  g('Grated nutmeg', 'Nutmeg', 'pinch'),
  g('Salt rim', 'Salt', 'rim'),
  g('Coffee beans', 'Coffee beans', 'each', '3'),
  g('Cucumber', 'Cucumber', 'slice'),
  g('Edible flower', 'Edible flower', 'each'),
];

// The amounts a stepper walks through, by unit: the measures bartenders pour.
const LADDERS: Record<string, number[]> = {
  ml: [5, 7.5, 10, 15, 20, 22.5, 25, 30, 35, 40, 45, 50, 60, 75, 90, 120],
  cl: [0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 4.5, 5, 6],
  oz: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4],
  bsp: [0.5, 1, 1.5, 2, 3],
  tsp: [0.5, 1, 1.5, 2, 3],
  tbsp: [0.5, 1, 1.5, 2, 3],
  g: [1, 2, 5, 10, 15, 20, 25, 30, 40, 50],
};
// The first tap of + on an empty line.
const START: Record<string, number> = { ml: 30, cl: 3, oz: 1, dash: 2, drop: 2, g: 10 };
const COUNTS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12];
const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** One tap of + or − on a line's amount. Below the smallest it clears (unmeasured). */
export function stepAmount(amount: string, unit: string, dir: 1 | -1): string {
  const ladder = LADDERS[unit] ?? COUNTS;
  const n = parseFloat(amount.replace(',', '.'));
  if (!Number.isFinite(n)) return dir > 0 ? fmt(START[unit] ?? 1) : '';
  if (dir > 0) {
    const up = ladder.find((v) => v > n + 1e-9);
    return fmt(up ?? n + (ladder.at(-1)! - ladder.at(-2)!));
  }
  const down = [...ladder].reverse().find((v) => v < n - 1e-9);
  return down === undefined ? '' : fmt(down);
}

/** The units a line can cycle through with one tap, in the order a bartender reaches for them. */
export const QUICK_UNITS = ['ml', 'oz', 'cl', 'dash', 'bsp', 'top', 'each', 'g'] as const;

export function nextUnit(unit: string): string {
  const i = (QUICK_UNITS as readonly string[]).indexOf(unit);
  return QUICK_UNITS[(i + 1) % QUICK_UNITS.length];
}

let counter = 0;
export function newLine(pick: WizardPick, unit: string, amount = ''): WizardLine {
  counter += 1;
  return { ...pick, key: `${Date.now().toString(36)}-${counter}`, amount, unit };
}

const amountOf = (s: string): number | null => {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** What the live sketch is drawn from. */
export function sketchLook(d: WizardDraft, barVariants: readonly string[] = []): DraftLook {
  return {
    name: d.name.trim() || 'New drink',
    description: d.description,
    glass: d.glass?.name ?? null,
    ice: d.ice?.name ?? null,
    methods: d.methods.map((m) => m.name),
    lines: [...d.lines, ...d.garnishes].map((l) => ({ name: l.name, amount: amountOf(l.amount), unit: l.unit || null })),
    variant: d.glassVariant ?? null,
    barVariants,
  };
}

/** The spec lines to save: ingredients, then garnishes. */
export function specLines(d: WizardDraft): { line: WizardLine; amount: number | null }[] {
  return [...d.lines, ...d.garnishes].map((line) => ({ line, amount: amountOf(line.amount) }));
}

/** "22.5 ml" or "Top" or "" */
export function amountLabel(l: Pick<WizardLine, 'amount' | 'unit'>): string {
  if (l.unit === 'top') return 'Top';
  const a = l.amount.trim();
  return a ? `${a} ${l.unit}`.trim() : '';
}

/** What every step screen gets: the draft, and a way to change part of it. */
export interface StepProps {
  draft: WizardDraft;
  set: (change: Partial<WizardDraft>) => void;
}

/** The unit a new line starts in: dashes of bitters, a top of soda, otherwise your usual. */
export function guessUnit(name: string, usual: string): string {
  const n = name.toLowerCase();
  if (/bitters|tincture|saline/.test(n)) return 'dash';
  if (/soda|tonic|ginger (beer|ale)|champagne|prosecco|cava|sparkling|cola|lemonade/.test(n) && !/syrup|cordial/.test(n)) return 'top';
  if (/\begg\b|egg white|egg yolk/.test(n)) return 'each';
  return usual;
}

// --- starting from a classic ---

/** A spec as a drink page loads it, cut down to what the wizard copies. */
export interface SourceSpec {
  id: string;
  name: string;
  recipes?: readonly { amount: number | null; unit: string | null; ingredient: { id: string; name: string } | null }[] | null;
  item_methods?: readonly { method_item_id: string; sort_order: number | null; method: { name: string } | null }[] | null;
  glassware?: { id: string; name: string } | null;
  ice?: { id: string; name: string } | null;
}

const GARNISH_UNIT = /^(peel|twist|wheel|slice|sprig|leaf|leaves|wedge|zest|garnish|spray|rim|pinch)s?$/;
const GARNISH_EACH = /cherr|olive|coffee bean|flower|petal|nutmeg|onion|mint|berry|berries/;
const POUR_ML: Record<string, number> = { ml: 1, cl: 10, oz: 30 };
const OZ_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];

/** A pour in another of ml, cl and oz ("22.5" ml is "0.75" oz); other units stay as they are. */
export function convertPour(amount: number | null, from: string, to: string): { amount: string; unit: string } {
  if (amount === null) return { amount: '', unit: from };
  if (from === to || !POUR_ML[from] || !POUR_ML[to]) return { amount: fmt(amount), unit: from };
  const n = (amount * POUR_ML[from]) / POUR_ML[to];
  const near = to === 'oz' ? OZ_STEPS.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a)) : n;
  return { amount: fmt(near), unit: to };
}

/**
 * A classic's spec as the start of a new drink: its lines (pours in your
 * usual unit, garnishes apart), methods in order, glass and ice, credited
 * as a version of it. The name and anything typed already are left alone.
 */
export function draftFromSpec(spec: SourceSpec, usual: string): Partial<WizardDraft> {
  const lines: WizardLine[] = [];
  const garnishes: WizardLine[] = [];
  for (const r of spec.recipes ?? []) {
    if (!r.ingredient) continue;
    const unit = (r.unit ?? '').trim().toLowerCase();
    const pick = { id: r.ingredient.id, name: r.ingredient.name };
    const garnish = GARNISH_UNIT.test(unit) || (unit === 'each' && GARNISH_EACH.test(pick.name.toLowerCase()));
    if (garnish) garnishes.push(newLine(pick, unit, r.amount === null ? '1' : fmt(r.amount)));
    else {
      const pour = convertPour(r.amount, unit || usual, usual);
      lines.push(newLine(pick, pour.unit, pour.amount));
    }
  }
  const methods = [...(spec.item_methods ?? [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .filter((m) => m.method?.name)
    .map((m) => ({ id: m.method_item_id, name: m.method!.name }));
  return {
    lines,
    garnishes,
    methods,
    glass: spec.glassware ? { id: spec.glassware.id, name: spec.glassware.name } : null,
    glassVariant: null,
    ice: spec.ice ? { id: spec.ice.id, name: spec.ice.name } : null,
    riffOf: { id: spec.id, name: spec.name },
  };
}
