/**
 * A technique as a template for a house prep: reading a name ("Coconut
 * fat-washed white rum") into what it changes and what with, naming one
 * back, how long it keeps, and what it contains. Pure, no catalog: the
 * builder (lib/prepKinds) turns this into a draft.
 */
import type { Allergen } from '../allergens';
import type { SlotRole, Storage, Technique } from './types';

// --- reading a name ---

/** Words in a name that say how it's made, longest first ("fat washed" before "washed"). */
const TECH_WORDS = [
  'fat washed', 'fat wash', 'lacto fermented', 'acid adjusted', 'oleo saccharum', 'super juice', 'sous vide', 'cold brew',
  'washed', 'wash', 'infused', 'infusion', 'clarified', 'smoked', 'steeped', 'compressed', 'pickled', 'fermented', 'carbonated',
  'redistilled', 'distilled', 'tincture', 'bitters', 'oil', 'syrup', 'shrub', 'cordial', 'oleo', 'foam', 'air', 'spheres', 'caviar',
  'powder', 'concentrate', 'kombucha', 'tepache', 'brine', 'dried', 'dehydrated', 'suspended', 'gomme', 'orgeat', 'grenadine', 'saline',
];
/** Words that say nothing about what's in it. */
const NOISE = new Set(['house', 'homemade', 'home', 'made', 'rich', 'simple', 'our', 'the', 'a', 'with']);
const SPIRITS = /^(rum|rhum|ron|gin|genever|vodka|whisky|whiskey|bourbon|rye|scotch|tequila|mezcal|brandy|cognac|armagnac|calvados|pisco|cachaça|cachaca|aquavit|akvavit|grappa|sake|soju|shochu|baijiu|vermouth|sherry|amaro|campari|aperol|absinthe|wine|port|madeira|spirit)$/;
const SPIRIT_MODS = /^(white|dark|aged|gold|golden|spiced|overproof|navy|blanco|reposado|anejo|añejo|london|dry|old|tom|irish|japanese|single|malt|blended|jamaican|agricole|demerara|silver|plata|sweet|blanc|rosso|bianco|fino|amontillado|oloroso)$/;

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * A name split at its technique word: "coconut fat washed white rum" is
 * before ["coconut"], word "fat washed", after ["white", "rum"]. Hyphens
 * read as spaces ("butter-washed"); noise words drop out.
 */
export function splitName(name: string): { before: string[]; word: string | null; after: string[] } {
  const tokens = name.toLowerCase().replace(/[^\p{L}\p{N}:\s-]/gu, ' ').replace(/-/g, ' ').split(/\s+/).filter((w) => w && !NOISE.has(w));
  for (let i = 0; i < tokens.length; i++) {
    for (const w of TECH_WORDS) {
      // "Coconut oil washed rum": the oil is what it's washed with, not an oil.
      if (w === 'oil' && /^(washed|wash)$/.test(tokens[i + 1] ?? '')) continue;
      const parts = w.split(' ');
      if (parts.every((p, k) => tokens[i + k] === p)) return { before: tokens.slice(0, i), word: w, after: tokens.slice(i + parts.length) };
    }
  }
  return { before: tokens, word: null, after: [] };
}

/** The spirit at the end of a name, with what describes it: "brown butter white rum" → "white rum". */
function trailingSpirit(tokens: string[]): number {
  const at = tokens.findIndex((t) => SPIRITS.test(t));
  if (at < 0) return -1;
  let start = at;
  while (start > 0 && SPIRIT_MODS.test(tokens[start - 1])) start--;
  return start;
}

export interface NameParts {
  /** What it changes: "White rum", "Grapefruit", "Mint". */
  base: string | null;
  /** The "with what": "Coconut", "Brown butter". */
  adjunct: string | null;
  /** Anything else the name says ("Chili" in a pineapple chili shrub). */
  extra: string[];
}

/** What a name says a technique changes and with what. */
export function nameParts(name: string, t: Pick<Technique, 'starts' | 'withWhat'>): NameParts {
  const { before, after } = splitName(name);
  let base: string[] = after;
  let rest = before;
  if (!base.length && t.starts === 'spirit') {
    const at = trailingSpirit(before);
    if (at >= 0) {
      base = before.slice(at);
      rest = before.slice(0, at);
    }
  }
  if (t.withWhat) {
    if (!base.length && !['spirit', 'wine'].includes(t.starts ?? '')) return { base: null, adjunct: rest.length ? cap(rest.join(' ')) : null, extra: [] };
    return { base: base.length ? cap(base.join(' ')) : null, adjunct: rest.length ? cap(rest.join(' ')) : null, extra: [] };
  }
  // No "with what": the name's first word is what it's made from, as a kind's flavour is.
  if (!base.length) return { base: rest[0] ? cap(rest[0]) : null, adjunct: null, extra: rest.slice(1).map(cap) };
  return { base: cap(base.join(' ')), adjunct: null, extra: rest.map(cap) };
}

/** "Grapefruit" into a "Juice" line reads "Grapefruit juice"; into "Peel", "Lemon peel". */
export function asLike(name: string, like: string): string {
  const kind = like.toLowerCase().match(/\b(juice|peel|zest)$/)?.[1];
  return kind && !name.toLowerCase().includes(kind) ? `${name} ${kind}` : name;
}

/**
 * The made thing's name, flavour then technique then base, as bartenders
 * write it: "Coconut fat-washed Bacardí Carta Blanca" from "{with}
 * fat-washed {base}". With no "with what", "{with}-washed" reads as the
 * technique's word ("Milk-washed gin").
 */
export function nameFor(t: Pick<Technique, 'nameAs' | 'name' | 'word'>, picked: { base?: string | null; adjunct?: string | null } = {}): string {
  if (!t.nameAs) return t.name;
  const out = t.nameAs
    .replace(/\{with\}-\S+/, (m) => (picked.adjunct ? m.replace('{with}', picked.adjunct) : (t.word ?? m.slice(7))))
    .replace('{with}', picked.adjunct ?? '')
    .replace('{base}', picked.base ?? '');
  return cap(tidy(out));
}

// --- keeps ---

/** How long it keeps and where, for this "with what" and name: the shortest matching variant wins. */
export function keepFor(t: Pick<Technique, 'keepsHours' | 'storage' | 'variants'>, picked: { adjunct?: string | null; name?: string } = {}): { hours: number | null; storage: Storage | null } {
  let hours = t.keepsHours ?? null;
  const matched = (t.variants ?? []).filter((v) => v.keepsHours !== undefined && v.words.test((v.on === 'name' ? picked.name : picked.adjunct)?.toLowerCase() ?? ''));
  if (matched.length) hours = Math.min(...matched.map((v) => v.keepsHours!));
  return { hours, storage: t.storage ?? null };
}

/** The parts for this name: a variant's (rich syrup's 2 : 1, a wine drink's water) or the technique's own. */
export function partsFor(t: Pick<Technique, 'parts' | 'variants'>, picked: { adjunct?: string | null; name?: string } = {}) {
  const v = (t.variants ?? []).find((x) => x.parts && x.words.test((x.on === 'name' ? picked.name : picked.adjunct)?.toLowerCase() ?? ''));
  return v?.parts ?? t.parts ?? [];
}

/**
 * The catalog ingredient a flavour word means in a slot: "coconut" in a fat
 * wash is Coconut Oil (not the fruit), in a vegan wash Coconut Milk. Only
 * names that exist in the catalog (checked against the local seed), and only
 * when the whole "with what" is that one thing: "Coconut and pistachio"
 * stays as typed.
 */
const SLOT_INGREDIENTS: Partial<Record<SlotRole, [RegExp, string][]>> = {
  fat: [
    [/^brown butter$/, 'Brown Butter'],
    [/^(unsalted )?butter$/, 'Butter'],
    [/^ghee$/, 'Ghee'],
    [/^bacon( fat| grease)?$/, 'Bacon Fat'],
    [/^duck( fat)?$/, 'Duck Fat'],
    [/^coconut( oil)?$/, 'Coconut Oil'],
    [/^(extra virgin )?olive( oil)?$/, 'Olive Oil'],
    [/^(toasted )?sesame( oil)?$/, 'Sesame Oil'],
    [/^peanut( butter)?$/, 'Peanut Butter'],
    [/^avocado( oil)?$/, 'Avocado Oil'],
    [/^walnut( oil)?$/, 'Walnut Oil'],
    [/^hazelnut( oil)?$/, 'Hazelnut Oil'],
    [/^pistachio( oil)?$/, 'Pistachio Oil'],
  ],
  milk: [
    [/^greek yogh?urt$/, 'Greek Yoghurt'],
    [/^yogh?urt$/, 'Yogurt'],
    [/^(heavy|double) cream$/, 'Heavy Cream'],
    [/^cream$/, 'Cream'],
    [/^cream cheese$/, 'Cream Cheese'],
    [/^whey$/, 'Whey'],
    [/^buttermilk$/, 'Buttermilk'],
    [/^ricotta$/, 'Ricotta'],
    [/^coconut cream$/, 'Coconut Cream'],
    [/^coconut( milk)?$/, 'Coconut Milk'],
    [/^soya?( milk)?$/, 'Soy Milk'],
    [/^oat( milk)?$/, 'Oat Milk'],
    [/^almond( milk)?$/, 'Almond Milk'],
    [/^cashew( milk)?$/, 'Cashew Milk'],
  ],
};

/** "Coconut" as a fat → "Coconut Oil"; null when the slot or the word has no catalog match. */
export function slotIngredient(role: SlotRole | undefined, flavour: string): string | null {
  const n = flavour.trim().toLowerCase().replace(/\s+/g, ' ');
  return (role && SLOT_INGREDIENTS[role]?.find(([re]) => re.test(n))?.[1]) ?? null;
}

// --- what's in it ---

/** Plant milks and butters that aren't dairy (or nuts, for cocoa and shea). */
const NOT_DAIRY = /\b(coconut|oat|soy|soya|almond|rice|pea|cashew|hemp|hazelnut|macadamia|peanut|cocoa|cacao|shea|nut|apple|sunflower|plant|vegan)\s+(milk|butter|cream|yogh?urt)\b/g;
const CONTAINS: [RegExp, Allergen][] = [
  [/\b(milk|butter|ghee|cream|cheese|yogh?urt|whey|buttermilk|ricotta|parmesan|casein|kefir|lactose)\b/, 'milk'],
  [/\b(almonds?|pistachios?|hazelnuts?|walnuts?|cashews?|pecans?|macadamias?|brazil nuts?|pine nuts?|nuts?|orgeat|marzipan|praline)\b/, 'tree_nuts'],
  [/\bpeanuts?\b/, 'peanuts'],
  [/\b(sesame|tahini)\b/, 'sesame'],
  [/\b(soy|soya|tofu|miso|edamame|lecithin)\b/, 'soya'],
  [/\b(eggs?|albumen|meringue)\b/, 'eggs'],
  [/\bchitosan\b/, 'crustaceans'],
  [/\b(fish|anchov\w*|isinglass)\b/, 'fish'],
  [/\b(wheat|barley|spelt)\b/, 'gluten'],
  [/\bmustard\b/, 'mustard'],
  [/\bcelery\b/, 'celery'],
  [/\b(wine|vermouth|sherry|champagne|prosecco|cava)\b/, 'sulphites'],
];
const PORK = /\b(bacon|lard|pork|prosciutto|chorizo|ham|pancetta|guanciale|jamon)\b/;
const NOT_VEGAN = /\b(honey|bacon|lard|pork|prosciutto|chorizo|ham|pancetta|beef|tallow|duck|chicken|schmaltz|gelatine?|carmine|cochineal|beeswax|marrow|foie)\b/;

export interface PrepFacts {
  /** Keys from lib/allergens (the 14 a venue declares). */
  allergens: Allergen[];
  /** Diet flags outside the 14: "Pork". */
  contains: string[];
  /** null when a line is still a stand-in, so nobody can say. */
  vegan: boolean | null;
}

/**
 * What a prep contains, read from its line names: butter is milk, coconut
 * oil is neither milk nor nut, bacon is pork, honey isn't vegan, chitosan
 * is shellfish unless it's fungal.
 */
export function prepFacts(names: readonly string[], unknown = false): PrepFacts {
  const allergens = new Set<Allergen>();
  const contains = new Set<string>();
  let vegan = true;
  for (const raw of names) {
    const n = raw.toLowerCase();
    const plant = n.replace(NOT_DAIRY, (m, plantWord: string) => (/(almond|cashew|hazelnut|macadamia|nut)/.test(plantWord) ? plantWord : plantWord === 'peanut' ? 'peanut' : plantWord === 'soy' || plantWord === 'soya' ? 'soy' : ' '));
    for (const [re, key] of CONTAINS) {
      if (key === 'crustaceans' && /fungal|vegan/.test(n)) continue;
      if (re.test(plant)) allergens.add(key);
    }
    if (PORK.test(n)) contains.add('Pork');
    if (allergens.has('milk') || allergens.has('eggs') || allergens.has('fish') || allergens.has('crustaceans') || NOT_VEGAN.test(n)) vegan = false;
  }
  return { allergens: [...allergens], contains: [...contains], vegan: vegan && unknown ? null : vegan };
}
