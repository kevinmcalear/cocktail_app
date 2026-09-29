/**
 * Flavor profiles from a drink's spec: the rule table and the arithmetic.
 *
 * Pure TypeScript with no Deno or npm imports, so the flavor-worker edge
 * function runs it and scripts/flavor.check.ts tests it with node.
 *
 * A profile is nine dimensions, each 0 to 1:
 *   sweet, sour, bitter, herbal, fruity, smoky, spicy, creamy: how much the
 *     drink tastes of it, from each ingredient's own taste weighted by how
 *     much of it goes in;
 *   strong: the spec's alcohol by volume before dilution, where 35% reads 1.
 * Every rule gives an ingredient's taste neat (lime juice is sour 1). A
 * drink's dimension is the amount-weighted average over the ingredients the
 * rules (or the AI fill) understood, times a per-dimension scale so that a
 * drink built around that taste reads about 0.8.
 *
 * Rules match the specific ingredient's name first (it may be a brand, like
 * "Campari"), then its generic ingredient's name, then its category names.
 * The first matching rule in RULES wins, so specific rules come before
 * general ones ("coffee liqueur" before "coffee", "sloe gin" before "gin").
 * Ingredients no rule knows are "unknown": they count against coverage and
 * are what the AI fill is asked about.
 *
 * Bump RULES_VERSION when the rules or scales change, then re-queue drinks
 * with private.enqueue_item_flavors() so stored profiles follow.
 */

export const DIMENSIONS = ['sweet', 'sour', 'bitter', 'strong', 'herbal', 'fruity', 'smoky', 'spicy', 'creamy'] as const;
export type Dimension = (typeof DIMENSIONS)[number];
/** Every dimension but strong, which comes from alcohol rather than taste. */
export type TasteDimension = Exclude<Dimension, 'strong'>;
export const TASTE_DIMENSIONS = DIMENSIONS.filter((d): d is TasteDimension => d !== 'strong');
export type Profile = Record<Dimension, number>;

export const RULES_VERSION = 1;

/** An ingredient's own taste, 0 to 1 per dimension, and its alcohol by volume (0.4 = 40%). */
export interface IngredientFlavor {
  taste: Partial<Record<TasteDimension, number>>;
  abv: number;
}

interface Rule extends IngredientFlavor {
  match: RegExp;
  /** How concentrated it is: bitters taste of far more than their volume. Default 1. */
  x?: number;
}

const r = (match: RegExp, abv: number, taste: IngredientFlavor['taste'], x?: number): Rule => ({ match, abv, taste, x });

// Specific before general. Names and category names are matched lowercased.
export const RULES: readonly Rule[] = [
  // --- neutral things that are still "known" ---
  r(/^(water|still water|ice|soda|soda water|club soda|seltzer|sparkling water|saline|saline solution|salt|sea salt)$/, 0, {}),

  // --- bitters and aperitivi ---
  r(/orange bitters/, 0.4, { bitter: 0.8, fruity: 0.6, spicy: 0.3 }, 8),
  r(/peychaud/, 0.35, { bitter: 0.7, herbal: 0.6, fruity: 0.3, sweet: 0.2 }, 8),
  r(/angostura|aromatic bitters|\bbitters\b/, 0.45, { bitter: 1, spicy: 0.6, herbal: 0.4 }, 8),
  r(/campari|bitter aperitivo|red bitter/, 0.25, { bitter: 1, sweet: 0.4, fruity: 0.3 }),
  r(/aperol/, 0.11, { bitter: 0.5, sweet: 0.5, fruity: 0.7 }),
  r(/fernet|branca menta/, 0.39, { bitter: 1, herbal: 1, spicy: 0.3 }),
  r(/cynar|carciofo|artichoke/, 0.165, { bitter: 0.8, herbal: 0.6, sweet: 0.3 }),
  r(/suze|gentian|salers|aveze/, 0.2, { bitter: 0.9, herbal: 0.6, sweet: 0.3 }),
  r(/rabarbaro|zucca/, 0.16, { bitter: 0.8, smoky: 0.4, sweet: 0.3 }),
  r(/amaro|averna|montenegro|nonino|ramazzotti|braulio|lucano|meletti|cardamaro|alpine amaro|amaro & bitter/, 0.28, { bitter: 0.8, sweet: 0.4, herbal: 0.6 }),

  // --- vermouth and aromatised wine ---
  r(/dry vermouth|extra dry|dolin dry|noilly/, 0.17, { bitter: 0.2, herbal: 0.5, sweet: 0.05, fruity: 0.1 }),
  r(/blanc vermouth|bianco|blanc \/ bianco/, 0.16, { sweet: 0.4, herbal: 0.4, fruity: 0.2 }),
  r(/sweet vermouth|rosso|red vermouth|carpano|antica formula|punt e mes|cocchi di torino|vermouth di torino/, 0.16, { sweet: 0.3, bitter: 0.3, herbal: 0.4, fruity: 0.2 }),
  r(/vermouth/, 0.16, { sweet: 0.25, bitter: 0.2, herbal: 0.4 }),
  r(/lillet|cocchi americano|kina|quinquina|aperitif wine|byrrh/, 0.17, { sweet: 0.35, fruity: 0.4, bitter: 0.2 }),

  // --- liqueurs (named) ---
  r(/yellow chartreuse/, 0.4, { herbal: 0.8, sweet: 0.6 }),
  r(/chartreuse/, 0.55, { herbal: 1, sweet: 0.4, spicy: 0.3 }),
  r(/b[ée]n[ée]dictine|drambuie|galliano|strega|herbal \/ monastic|herbal liqueur/, 0.4, { herbal: 0.7, sweet: 0.7, spicy: 0.2 }),
  r(/absinthe|pastis|pernod|ricard|anis|ouzo|sambuca|herbsaint/, 0.55, { herbal: 1, bitter: 0.2, sweet: 0.1 }),
  r(/coffee liqueur|kahl[uú]a|tia maria|mr black|borghetti/, 0.2, { sweet: 0.7, bitter: 0.35 }),
  r(/cream liqueur|baileys|irish cream|amarula/, 0.17, { creamy: 0.9, sweet: 0.6 }),
  r(/cr[eè]me de cacao|chocolate liqueur/, 0.24, { sweet: 0.8, creamy: 0.2, bitter: 0.1 }),
  r(/cr[eè]me de menthe|mint liqueur/, 0.25, { sweet: 0.8, herbal: 0.7 }),
  r(/cr[eè]me de (cassis|m[uû]re|framboise|p[eê]che)|chambord|cassis/, 0.16, { sweet: 0.8, fruity: 1 }),
  r(/cr[eè]me de violette|violette|parfait amour/, 0.2, { sweet: 0.8, herbal: 0.3, fruity: 0.3 }),
  r(/maraschino|luxardo/, 0.32, { sweet: 0.5, fruity: 0.4, herbal: 0.2 }),
  r(/st[- .]*germain|elderflower/, 0.2, { sweet: 0.6, fruity: 0.5, herbal: 0.2 }),
  r(/cointreau|triple sec|cura[cç]ao|grand marnier|orange liqueur|combier/, 0.38, { sweet: 0.5, fruity: 0.8, bitter: 0.05 }),
  r(/amaretto|disaronno|frangelico|nocino|nut\/seed liqueur|nut liqueur/, 0.25, { sweet: 0.8, creamy: 0.2, bitter: 0.1 }),
  r(/limoncello/, 0.3, { sweet: 0.7, sour: 0.2, fruity: 0.5 }),
  r(/falernum/, 0.11, { sweet: 0.7, spicy: 0.4, fruity: 0.2 }),
  r(/allspice dram|pimento dram/, 0.3, { spicy: 1, sweet: 0.5 }),
  r(/pimm'?s/, 0.25, { sweet: 0.4, fruity: 0.5, bitter: 0.2, herbal: 0.3 }),
  r(/sloe gin/, 0.26, { sweet: 0.5, fruity: 0.8, sour: 0.2 }),
  r(/(apricot|peach|banana|cherry|pear|apple|melon|passion ?fruit|raspberry|blackberry|fruit) liqueur|midori|heering|fruit liqueur/, 0.2, { sweet: 0.7, fruity: 0.9 }),
  r(/ginger liqueur|domaine de canton/, 0.2, { sweet: 0.6, spicy: 0.6 }),
  r(/liqueur|liquore|schnapps/, 0.25, { sweet: 0.6, fruity: 0.3 }),

  // --- fortified wine, wine and beer ---
  r(/pedro xim[eé]nez|\bpx\b|cream sherry/, 0.17, { sweet: 1, fruity: 0.4 }),
  r(/fino|manzanilla|amontillado|oloroso|palo cortado|sherry/, 0.17, { sweet: 0.05, fruity: 0.1, herbal: 0.1 }),
  r(/\bport\b|madeira|marsala|fortified|dessert/, 0.19, { sweet: 0.6, fruity: 0.6 }),
  r(/champagne|prosecco|cava|cr[eé]mant|sparkling wine|sparkling|\bsekt\b/, 0.12, { fruity: 0.3, sour: 0.25, sweet: 0.05 }),
  r(/red wine|^red$/, 0.13, { fruity: 0.5, bitter: 0.2 }),
  r(/\bwine\b|^white$|\bros[eé]\b(?! water)/, 0.12, { fruity: 0.4, sour: 0.2 }),
  r(/ginger beer|ginger ale/, 0, { sweet: 0.5, spicy: 0.6 }),
  r(/\bipa\b|pale ale|stout|porter|lager|pilsner|\bbeer\b|\bale\b|cider/, 0.05, { bitter: 0.3, fruity: 0.1 }),

  // --- spirits ---
  r(/islay|peat|laphroaig|ardbeg|lagavulin|caol ila/, 0.43, { smoky: 1, herbal: 0.1 }),
  r(/mezcal|sotol|raicilla|bacanora|tobal[aá]|espad[ií]n|tepeztate|ensamble/, 0.45, { smoky: 0.8, herbal: 0.3, fruity: 0.1 }),
  r(/dark rum|black rum|a[nñ]ejo rum|aged rum|demerara rum|jamaican rum|blackstrap/, 0.43, { sweet: 0.25, fruity: 0.3, smoky: 0.05 }),
  r(/tequila|blanco|reposado|a[nñ]ejo|agave spirit/, 0.4, { herbal: 0.3, spicy: 0.2, sweet: 0.05 }),
  r(/\brye\b/, 0.45, { spicy: 0.4, sweet: 0.1 }),
  r(/bourbon|tennessee|corn whiskey/, 0.45, { sweet: 0.1, spicy: 0.15 }),
  r(/scotch|single malt|highland|speyside|blended malt/, 0.42, { smoky: 0.3, sweet: 0.1, fruity: 0.1 }),
  r(/whisk(e)?y|whisk\(e\)y/, 0.42, { sweet: 0.15, spicy: 0.15, smoky: 0.05 }),
  r(/navy strength|overproof/, 0.57, { herbal: 0.3 }),
  r(/genever|old tom/, 0.4, { herbal: 0.4, sweet: 0.2 }),
  r(/\bgin\b|london dry|contemporary \/ new western/, 0.42, { herbal: 0.6, fruity: 0.1 }),
  r(/agricole|cacha[cç]a|clairin/, 0.45, { herbal: 0.3, fruity: 0.3 }),
  r(/spiced rum/, 0.35, { sweet: 0.3, spicy: 0.4 }),
  r(/\brum\b|\bron\b|\brhum\b|sugarcane/, 0.4, { sweet: 0.15, fruity: 0.15 }),
  r(/cognac|armagnac|brandy|calvados|applejack|grappa|eau-de-vie|eau de vie|pisco/, 0.4, { fruity: 0.4, sweet: 0.1 }),
  r(/vodka/, 0.4, {}),
  r(/aquavit|akvavit/, 0.42, { herbal: 0.7, spicy: 0.2 }),
  r(/shochu|soju|baijiu|awamori|arrack|sake/, 0.25, { fruity: 0.1, herbal: 0.1 }),

  // --- coffee, tea, chocolate ---
  r(/espresso|cold brew|coffee/, 0, { bitter: 0.7, creamy: 0.35 }),
  r(/lapsang|smoked tea/, 0, { smoky: 0.6, bitter: 0.2 }),
  r(/\btea\b|matcha|earl grey/, 0, { bitter: 0.3, herbal: 0.4 }),
  r(/chocolate|cacao|cocoa/, 0, { bitter: 0.4, sweet: 0.4, creamy: 0.3 }),

  // --- dairy and texture ---
  r(/coconut cream|cream of coconut|coco l[oó]pez|coconut milk/, 0, { creamy: 0.9, sweet: 0.5, fruity: 0.3 }),
  r(/egg white|aquafaba|foamer/, 0, { creamy: 0.8 }),
  r(/egg yolk|whole egg|\begg\b/, 0, { creamy: 1, sweet: 0.1 }),
  r(/cream|milk|butter|yogh?urt|ice cream/, 0, { creamy: 1, sweet: 0.1 }),

  // --- juices and acids ---
  r(/(lemon|lime|yuzu|calamansi) (juice|cordial)|^lemon$|^lime$|fresh lemon|fresh lime|citric|malic|acid|sour mix/, 0, { sour: 1, fruity: 0.15 }),
  r(/grapefruit/, 0, { sour: 0.5, bitter: 0.3, fruity: 0.6 }),
  r(/orange juice|blood orange|mandarin|clementine/, 0, { sour: 0.25, sweet: 0.4, fruity: 0.8 }),
  r(/pineapple/, 0, { sour: 0.15, sweet: 0.5, fruity: 0.9 }),
  r(/cranberry/, 0, { sour: 0.4, fruity: 0.8, sweet: 0.3, bitter: 0.1 }),
  r(/passion ?fruit|mango|guava|papaya|lychee/, 0, { fruity: 1, sweet: 0.5, sour: 0.3 }),
  r(/tomato|clamato/, 0, { fruity: 0.2, sour: 0.2 }),
  r(/verjus|shrub|vinegar/, 0, { sour: 0.7, fruity: 0.3 }),
  r(/apple juice|pear juice|grape juice|watermelon|strawberr|raspberr|blackberr|blueberr|cherr|peach|apricot|\bjuice\b|pur[eé]e/, 0, { fruity: 0.9, sweet: 0.4, sour: 0.2 }),

  // --- syrups and sweeteners ---
  r(/grenadine|pomegranate/, 0, { sweet: 0.9, fruity: 0.5 }),
  r(/orgeat/, 0, { sweet: 0.8, creamy: 0.4 }),
  r(/ginger (syrup|juice)|\bginger\b/, 0, { spicy: 0.8, sweet: 0.4 }),
  r(/cinnamon|clove|nutmeg|cardamom|star anise|chai|spice syrup/, 0, { spicy: 0.6, sweet: 0.6 }),
  r(/chil[ie]|jalape[nñ]o|habanero|tabasco|hot sauce|sriracha|cayenne|pepper/, 0, { spicy: 1 }, 3),
  r(/worcestershire/, 0, { spicy: 0.3, sour: 0.2 }, 3),
  r(/honey/, 0, { sweet: 0.9, herbal: 0.05 }),
  r(/maple/, 0, { sweet: 1, smoky: 0.05 }),
  r(/vanilla/, 0, { sweet: 0.9, creamy: 0.2 }),
  r(/raspberry syrup|strawberry syrup|berry syrup|cherry syrup|fruit syrup/, 0, { sweet: 0.9, fruity: 0.7 }),
  r(/oleo|cordial/, 0, { sweet: 0.7, sour: 0.3, fruity: 0.5 }),
  r(/rich (simple )?syrup|demerara|2:1/, 0, { sweet: 1 }, 1.4),
  r(/sugar cube|\bsugar\b(?! syrup)/, 0, { sweet: 1 }, 4),
  r(/agave (syrup|nectar)|simple syrup|gomme|\bsyrup\b/, 0, { sweet: 1 }),
  r(/cola/, 0, { sweet: 0.8, spicy: 0.1 }),
  r(/tonic/, 0, { bitter: 0.4, sweet: 0.4 }),
  r(/lemonade|lemon soda|lime soda/, 0, { sweet: 0.6, sour: 0.4, fruity: 0.3 }),

  // --- garnishes and herbs ---
  r(/\bmint\b|basil|sage|rosemary|thyme|shiso|cucumber|celery/, 0, { herbal: 1 }, 3),
  r(/(lemon|orange|grapefruit|lime) (peel|twist|zest|wheel|wedge|slice)|citrus peel|twist|zest/, 0, { fruity: 0.6, bitter: 0.2 }),
  r(/olive|brine/, 0, { herbal: 0.2 }),
  r(/cherry|cherries|onion|nutmeg/, 0, { sweet: 0.3, fruity: 0.3 }),
];

/**
 * How many points past a neat ingredient's 0 to 1 a drink's average is pulled
 * up, per dimension, so a drink built around that taste reads about 0.8.
 */
export const SCALE: Record<TasteDimension, number> = {
  sweet: 2.6,
  sour: 3.6,
  bitter: 2.2,
  herbal: 2.2,
  fruity: 2,
  smoky: 2.4,
  spicy: 2.4,
  creamy: 3,
};

/** The spec's alcohol by volume that reads as strong 1. */
export const STRONG_ABV = 0.35;

// Bar units in ml. Dashes and drops are approximate.
const VOLUME_ML: Record<string, number> = {
  ml: 1, cl: 10, dl: 100, l: 1000, oz: 29.57, 'fl oz': 29.57,
  dash: 0.8, dashes: 0.8, drop: 0.05, drops: 0.05,
  bsp: 5, barspoon: 5, tsp: 5, tbsp: 15, splash: 10,
};
// A garnish or a counted thing (a mint leaf, a sugar cube): tastes of about
// this many ml, adds no volume.
const GARNISH_ML = 1.5;
// A top of soda or wine, or a liquid with no amount written down.
const TOP_ML = 60;
const UNMEASURED_ML = 10;

/** One line of a spec, with what the worker knows about its ingredient. */
export interface SpecPart {
  /** The specific ingredient's id (the AI fill's cache key). */
  id: string | null;
  name: string;
  genericName?: string | null;
  categories?: readonly string[];
  amount: number | null;
  unit: string | null;
  /** The AI fill's answer for this ingredient, when the rules don't know it. */
  ai?: IngredientFlavor | null;
}

/** How much a line tastes of (flavor) and how much it adds to the glass (volume), both in ml. */
export function partWeight(part: Pick<SpecPart, 'amount' | 'unit' | 'name'>): { flavor: number; volume: number } {
  const unit = (part.unit ?? '').trim().toLowerCase();
  const perMl = VOLUME_ML[unit || 'ml'];
  if (unit === 'top' || (part.amount === null && /soda|tonic|ginger|champagne|prosecco|sparkling|cola|beer|lemonade/i.test(part.name))) {
    return { flavor: TOP_ML, volume: TOP_ML };
  }
  if (perMl === undefined) {
    const n = part.amount ?? 1;
    return { flavor: n * GARNISH_ML, volume: 0 };
  }
  const ml = part.amount === null ? UNMEASURED_ML : part.amount * perMl;
  return { flavor: ml, volume: ml };
}

/** The first rule that matches the ingredient, its generic ingredient, or a category. */
export function ruleFor(part: Pick<SpecPart, 'name' | 'genericName' | 'categories'>): Rule | null {
  const texts = [part.name, part.genericName ?? '', ...(part.categories ?? [])].map((t) => t.trim().toLowerCase()).filter(Boolean);
  for (const text of texts) {
    const rule = RULES.find((rule) => rule.match.test(text));
    if (rule) return rule;
  }
  return null;
}

export interface SpecProfile {
  profile: Profile;
  /** Share of the spec (by taste weight) the rules or the AI fill understood, 0 to 1. */
  coverage: number;
  /** Lines nothing understood yet: what the AI fill is asked about. */
  unknown: SpecPart[];
  /** Whether any AI answer went into the profile. */
  usedAi: boolean;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** A drink's profile from its spec lines. An empty or unreadable spec gives all zeros and coverage 0. */
export function profileFromSpec(parts: readonly SpecPart[]): SpecProfile {
  const sums = Object.fromEntries(TASTE_DIMENSIONS.map((d) => [d, 0])) as Record<TasteDimension, number>;
  let known = 0;
  let total = 0;
  let alcohol = 0;
  let volume = 0;
  let usedAi = false;
  const unknown: SpecPart[] = [];

  for (const part of parts) {
    const weight = partWeight(part);
    if (weight.flavor <= 0) continue;
    total += weight.flavor;
    const rule = ruleFor(part);
    const flavor: IngredientFlavor | null = rule ?? part.ai ?? null;
    if (!flavor) {
      unknown.push(part);
      continue;
    }
    if (!rule) usedAi = true;
    const x = rule?.x ?? 1;
    known += weight.flavor;
    for (const d of TASTE_DIMENSIONS) sums[d] += weight.flavor * x * clamp01(flavor.taste[d] ?? 0);
    alcohol += weight.volume * clamp01(flavor.abv);
    volume += weight.volume;
  }

  const profile = { strong: volume > 0 ? round3(clamp01(alcohol / volume / STRONG_ABV)) : 0 } as Profile;
  for (const d of TASTE_DIMENSIONS) profile[d] = known > 0 ? round3(clamp01((sums[d] / known) * SCALE[d])) : 0;
  return { profile, coverage: total > 0 ? round3(known / total) : 0, unknown, usedAi };
}

/**
 * Reads the AI fill's JSON answer: {"ingredients": [{"id", "abv", "sweet", ...}]}.
 * Keeps only ids that were asked about, clamps every number to 0..1 and drops
 * anything else, so nothing but numbers is ever stored.
 */
export function parseAiFlavors(text: string, askedIds: readonly string[]): Map<string, IngredientFlavor> {
  const out = new Map<string, IngredientFlavor>();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return out;
  }
  const rows = (data as { ingredients?: unknown })?.ingredients;
  if (!Array.isArray(rows)) return out;
  const asked = new Set(askedIds);
  for (const row of rows as Record<string, unknown>[]) {
    const id = typeof row?.id === 'string' ? row.id : null;
    if (!id || !asked.has(id) || out.has(id)) continue;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? round3(clamp01(v)) : 0);
    const taste: IngredientFlavor['taste'] = {};
    for (const d of TASTE_DIMENSIONS) {
      const v = num(row[d]);
      if (v > 0) taste[d] = v;
    }
    out.set(id, { taste, abv: num(row.abv) });
  }
  return out;
}

/** The AI fill's prompt for the lines the rules don't know. Names go to the model only, never back to the app. */
export function aiPrompt(parts: readonly SpecPart[]): string {
  const lines = parts.map((p) =>
    JSON.stringify({ id: p.id, name: p.name, generic: p.genericName ?? null, categories: p.categories ?? [] })
  );
  return [
    'You are a bartender describing cocktail ingredients by taste.',
    'For each ingredient below, say how it tastes neat, each dimension from 0 (none) to 1 (as much as any ingredient has):',
    `${TASTE_DIMENSIONS.join(', ')}; and abv, its alcohol by volume from 0 to 1 (0.4 for a 40% spirit, 0 for a syrup).`,
    'House-made ingredients are often syrups, cordials, infusions or tinctures: judge from the name.',
    'Answer with JSON only: {"ingredients": [{"id": "...", "abv": 0, "sweet": 0, ...}]}, one entry per id, numbers only.',
    '',
    ...lines,
  ].join('\n');
}
