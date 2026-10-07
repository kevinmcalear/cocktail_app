/**
 * What a drink looks like, for the drawing the app paints when it has no
 * photo: its glass, ice, method, the colour of the liquid, any foam, float or
 * drizzle, bubbles and garnish.
 *
 * Pure TypeScript with no imports, like flavor.ts, so the flavor-worker runs
 * it (in the same job as the flavor profile) and scripts/sketch.check.ts tests
 * it with node.
 *
 * Every field comes from the drink's own data first (its glassware, ice and
 * methods), then from rules over its spec, name and description, then from
 * the AI fill, and last from a plain default. The result holds enums, numbers
 * and hex colours only, never names, so it can be read wherever the drink can.
 *
 * Bump SKETCH_VERSION when the rules change, then re-queue drinks with
 * private.enqueue_item_flavors() so stored inputs follow.
 */

export const SKETCH_VERSION = 2;

export const GLASSES = [
  'coupe', 'nick', 'martini', 'rocks', 'highball', 'collins', 'fizz', 'flute',
  'wine', 'spritz', 'snifter', 'julep', 'tiki', 'mug', 'ceramic', 'beer',
] as const;
export const ICES = ['none', 'cubes', 'large', 'spear', 'crushed', 'pebble', 'shaved', 'sphere'] as const;
export const METHODS = ['shake', 'stir', 'build', 'blend', 'swizzle', 'throw', 'pour'] as const;
export const FOAMS = ['cap', 'crema', 'froth', 'silk', 'sheen'] as const;
export const GARNISHES = [
  'orange_peel', 'lemon_peel', 'grapefruit_peel', 'lime_wheel', 'lemon_wheel', 'orange_wheel', 'lime_wedge',
  'cherry', 'olive', 'onion', 'mint', 'herb', 'berries', 'strawberry', 'pineapple', 'coffee_beans',
  'grated_spice', 'flower', 'cucumber', 'salt_rim', 'sugar_rim', 'ginger', 'chili', 'apple',
] as const;
export const SOURCES = ['data', 'rules', 'ai', 'default'] as const;

export type Glass = (typeof GLASSES)[number];
export type Ice = (typeof ICES)[number];
export type Method = (typeof METHODS)[number];
export type Foam = (typeof FOAMS)[number];
export type Garnish = (typeof GARNISHES)[number];
export type Source = (typeof SOURCES)[number];

export interface SketchInputs {
  v: number;
  glass: Glass;
  ice: Ice;
  method: Method;
  /** The liquid as poured: its colour and how opaque it reads, 0.14 to 1. */
  liquid: { hex: string; alpha: number };
  foam: Foam | null;
  /** A layer floated on top, and a liqueur drizzled through the ice: hex colours. */
  float: string | null;
  bleed: string | null;
  fizz: boolean;
  garnish: Garnish | null;
  /** Where each guess came from. */
  from: { glass: Source; ice: Source; method: Source; liquid: Source; garnish: Source };
  /** Share of the spec (by volume) whose colour the rules or the AI fill knew. */
  coverage: number;
}

/** What the AI fill says an ingredient looks like. */
export interface IngredientLook {
  /** The liquid's colour as poured, '#rrggbb'. */
  color: string;
  /** How strongly it colours a drink: 0 for a clear spirit, 1 for Campari. */
  tint: number;
  foam?: Foam | null;
}

/** What the AI fill guesses about a whole drink, for whatever its data and the rules don't settle. */
export interface DrinkLook {
  glass?: Glass;
  ice?: Ice;
  method?: Method;
  garnish?: Garnish | null;
  color?: string;
  foam?: Foam | null;
}

/** One spec line, with its volume (from flavor.ts partWeight) and any cached AI answer. */
export interface SketchLine {
  id: string | null;
  name: string;
  genericName?: string | null;
  categories?: readonly string[];
  amount: number | null;
  unit: string | null;
  /** ml it adds to the glass; 0 for a garnish or a counted thing. */
  volume: number;
  look?: IngredientLook | null;
}

export interface SketchDrink {
  name: string;
  description?: string | null;
  /** The drink's own glassware, ice and method item names, when set. */
  glass?: string | null;
  ice?: string | null;
  methods?: readonly string[];
  lines: readonly SketchLine[];
  /** A cached AI answer for the whole drink. */
  ai?: DrinkLook | null;
}

export interface SketchResult {
  inputs: SketchInputs;
  /** Lines whose colour nothing knows yet: what the AI fill is asked about. */
  unknown: SketchLine[];
  /** Whether the AI fill should be asked about the drink as a whole. */
  askDrink: boolean;
  usedAi: boolean;
}

// ---------------------------------------------------------------------------
// The drink's own data
// ---------------------------------------------------------------------------

// Specific before general. Matched against lowercased glassware names.
const GLASS_NAMES: readonly [RegExp, Glass][] = [
  [/nick|nora|pony|chartreuse glass|liqueur glass/, 'nick'],
  [/coupetini|martini|cocktail glass|v[- ]?glass/, 'martini'],
  [/coupe|coupette|saucer/, 'coupe'],
  [/julep/, 'julep'],
  [/tiki|skull|volcano|scorpion bowl/, 'tiki'],
  [/mug|copper|toddy|irish coffee|tea ?cup/, 'mug'],
  [/ceramic|clay|bamboo|coconut|cup\b/, 'ceramic'],
  [/flute|champagne/, 'flute'],
  [/spritz|balloon|copa|goblet/, 'spritz'],
  [/wine/, 'wine'],
  [/snifter|brandy|tasting|glencairn|nosing/, 'snifter'],
  [/collins|swizzle|zombie|chimney|sling|hurricane|tall/, 'collins'],
  [/small highball|fizz|delmonico|juice glass|tumbler tall/, 'fizz'],
  [/highball/, 'highball'],
  [/beer|pint|schooner|pilsner|tulip|stein|nonic/, 'beer'],
  [/rocks|old fashioned|lowball|tumbler|\bdof\b|double|butcher/, 'rocks'],
];
const ICE_NAMES: readonly [RegExp, Ice][] = [
  [/crush|cracked|frapp/, 'crushed'],
  [/pebble|nugget|pellet|sonic/, 'pebble'],
  [/shaved|snow|kakig[oō]ri/, 'shaved'],
  [/spear|collins ice|column/, 'spear'],
  [/sphere|ball/, 'sphere'],
  [/large|big|king|block|single|clear cube|rock\b/, 'large'],
  [/cube|ice/, 'cubes'],
  [/none|neat|\bup\b/, 'none'],
];
const METHOD_NAMES: readonly [RegExp, Method][] = [
  [/blend|blitz|frozen|whizz?/, 'blend'],
  [/swizzl/, 'swizzle'],
  [/throw|roll/, 'throw'],
  [/shak|whip|dry/, 'shake'],
  [/stir/, 'stir'],
  [/straight|pour|neat/, 'pour'],
  [/build|built|top|layer|muddle|float/, 'build'],
];
// When a drink has several methods, the one that shapes how it looks.
const METHOD_RANK: readonly Method[] = ['blend', 'shake', 'swizzle', 'throw', 'stir', 'build', 'pour'];

const first = <T>(table: readonly [RegExp, T][], text: string | null | undefined): T | null => {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return null;
  for (const [re, v] of table) if (re.test(t)) return v;
  return null;
};

export const glassFromName = (name: string | null | undefined) => first(GLASS_NAMES, name);
export const iceFromName = (name: string | null | undefined) => first(ICE_NAMES, name);
export function methodFromNames(names: readonly string[] | undefined): Method | null {
  const found = (names ?? []).map((n) => first(METHOD_NAMES, n)).filter((m): m is Method => !!m);
  if (!found.length) return null;
  return METHOD_RANK.find((m) => found.includes(m)) ?? null;
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

interface ColorRule {
  match: RegExp;
  hex: string;
  /** How strongly it colours the drink, per ml. Dashes of bitters are concentrated. */
  tint: number;
  /** Turns the drink opaque (cream, juice pulp, egg). */
  cloudy?: boolean;
  foam?: Foam;
  fizz?: boolean;
  /** A garnish or aroma that adds no colour. */
  clear?: boolean;
}

const c = (match: RegExp, hex: string, tint: number, more: Partial<ColorRule> = {}): ColorRule => ({ match, hex, tint, ...more });
const CLEAR = '#F2F2EC';

// Specific before general, like flavor.ts. Names and category names are matched lowercased.
export const COLOR_RULES: readonly ColorRule[] = [
  // --- foam makers first: their name says more than their colour ---
  c(/egg white|aquafaba|foamer|fee foam|ms\.? better|wonderfoam|whip(ped)? (cream|foam)/, '#F4EEDD', 0, { foam: 'cap', cloudy: true }),
  c(/egg yolk|whole egg|\begg\b/, '#F2D07A', 1, { cloudy: true, foam: 'silk' }),

  // --- bitters: a dash colours a lot ---
  c(/peychaud/, '#C0303A', 4),
  c(/orange bitters/, '#C0702A', 2),
  c(/angostura|aromatic bitters|\bbitters\b/, '#6E1A0E', 4),

  // --- aperitivi, amari and vermouth ---
  c(/campari|bitter aperitivo|red bitter|select aperitivo|contratto bitter/, '#C8102E', 1),
  c(/aperol/, '#F0651C', 1),
  c(/fernet|branca/, '#2E1C10', 1.2),
  c(/cynar|carciofo|artichoke/, '#3E2412', 1),
  c(/suze|gentian|salers|aveze/, '#E8C83A', 0.7),
  c(/amaro|averna|montenegro|nonino|ramazzotti|braulio|lucano|meletti|cardamaro|rabarbaro|zucca/, '#7A3A16', 0.8),
  c(/dry vermouth|extra dry|dolin dry|noilly/, '#EDE3B8', 0.15),
  c(/blanc vermouth|bianco|blanc \/ bianco/, '#EAD9A0', 0.2),
  c(/sweet vermouth|rosso|red vermouth|carpano|antica formula|punt e mes|cocchi di torino|vermouth di torino/, '#6E2316', 0.85),
  c(/vermouth/, '#9A5A2A', 0.5),
  c(/lillet|cocchi americano|kina|quinquina|aperitif wine/, '#E8CB6E', 0.45),
  c(/byrrh|cocchi rosa|lillet rouge/, '#8A1A28', 0.8),

  // --- liqueurs ---
  c(/yellow chartreuse/, '#E6C84A', 0.8),
  c(/chartreuse/, '#86B23A', 0.9),
  c(/b[ée]n[ée]dictine|drambuie/, '#C8862E', 0.7),
  c(/galliano/, '#F0CE2A', 0.9),
  c(/strega/, '#E8D040', 0.8),
  c(/absinthe blanche|la blanche|white absinthe/, CLEAR, 0.02),
  c(/absinthe|herbsaint/, '#8CB050', 0.6),
  c(/pastis|pernod|ricard|anis|ouzo|sambuca/, '#F0E8C0', 0.15),
  c(/coffee liqueur|kahl[uú]a|tia maria|mr black|borghetti/, '#3A2214', 1),
  c(/cream liqueur|baileys|irish cream|amarula/, '#D8BC94', 1.2, { cloudy: true }),
  c(/dark cr[eè]me de cacao|brown cacao|dark cacao/, '#4A2412', 0.9),
  c(/cr[eè]me de cacao|chocolate liqueur|white cacao/, '#F2ECDF', 0.05),
  c(/white cr[eè]me de menthe|white menthe/, CLEAR, 0.02),
  c(/cr[eè]me de menthe|mint liqueur/, '#2FA552', 1),
  c(/cr[eè]me de (cassis|m[uû]re)|cassis|blackberry liqueur/, '#4B0F33', 1.2),
  c(/cr[eè]me de framboise|chambord|raspberry liqueur/, '#8A1036', 1.1),
  c(/cr[eè]me de violette|violette|parfait amour/, '#8D7BC4', 1.3),
  c(/blue cura[cç]ao/, '#1E6FD0', 1.2),
  c(/grand marnier|dry cura[cç]ao|orange cura[cç]ao/, '#C8822E', 0.5),
  c(/cointreau|triple sec|combier|orange liqueur/, '#F3F0E4', 0.03),
  c(/maraschino|luxardo maraschino/, '#F1ECDD', 0.05),
  c(/st[- .]*germain|elderflower/, '#F0E2A0', 0.15),
  c(/amaretto|disaronno|frangelico/, '#B06A2A', 0.7),
  c(/nocino|walnut liqueur/, '#2A1A10', 1.1),
  c(/limoncello/, '#F4E24A', 0.9, { cloudy: true }),
  c(/falernum/, '#F0E6C8', 0.3),
  c(/allspice dram|pimento dram/, '#5A2410', 0.9),
  c(/pimm'?s/, '#8A3A1E', 0.8),
  c(/sloe gin/, '#8A1838', 1),
  c(/midori|melon liqueur/, '#5ACB3C', 1.1),
  c(/heering|cherry liqueur|kirsch liqueur/, '#6A0E20', 1),
  c(/apricot liqueur|abricot/, '#E8903A', 0.7),
  c(/banana liqueur|banane/, '#E8D060', 0.6),
  c(/peach liqueur|p[eê]che/, '#F0B070', 0.4),
  c(/ginger liqueur|domaine de canton/, '#E8C878', 0.4),
  c(/passion ?fruit liqueur|passoa/, '#E89A2A', 0.8),
  c(/liqueur|liquore|schnapps|cordial liqueur/, '#D8A050', 0.4),

  // --- fortified wine, wine, beer and soft drinks ---
  c(/pedro xim[eé]nez|\bpx\b|cream sherry/, '#2E140A', 1.1),
  c(/oloroso|palo cortado/, '#8A4A1E', 0.8),
  c(/amontillado/, '#B87A36', 0.6),
  c(/fino|manzanilla/, '#EDE0A8', 0.35),
  c(/sherry/, '#C08A3E', 0.5),
  c(/ruby port|\bport\b/, '#6A0E22', 1),
  c(/tawny|madeira|marsala/, '#9A4E1E', 0.8),
  c(/ros[eé] (champagne|prosecco|cava|sparkling)|sparkling ros[eé]/, '#F2B4AE', 0.4, { fizz: true }),
  c(/champagne|prosecco|cava|cr[eé]mant|sparkling wine|\bsekt\b|lambrusco/, '#F0E4B0', 0.15, { fizz: true }),
  c(/ros[eé]\b(?! water)/, '#F2A8A0', 0.5),
  c(/red wine|^red$|claret/, '#6A0E22', 1),
  c(/orange wine|skin contact/, '#E0943A', 0.6),
  c(/\bwine\b|^white$/, '#F0E6B4', 0.15),
  c(/stout|porter|guinness/, '#1A0E08', 1.3, { foam: 'cap', fizz: true }),
  c(/\bipa\b|pale ale|amber ale|\bale\b/, '#D48A2A', 0.6, { fizz: true }),
  c(/lager|pilsner|\bbeer\b|kölsch|wheat beer|hefeweizen/, '#E8B84A', 0.4, { fizz: true }),
  c(/cider/, '#E8C060', 0.4, { fizz: true }),
  c(/ginger beer/, '#EEE2B8', 0.25, { fizz: true, cloudy: true }),
  c(/ginger ale/, '#E4C478', 0.3, { fizz: true }),
  c(/\bcola\b|coke|dr pepper/, '#2E1408', 1.2, { fizz: true }),
  c(/lemonade|lemon soda|lime soda|sprite|7 ?up/, '#F2EED0', 0.15, { fizz: true }),
  c(/grapefruit soda|pamplemousse soda|squirt|jarritos toronja/, '#F2C2AE', 0.3, { fizz: true }),
  c(/tonic/, CLEAR, 0, { fizz: true }),
  c(/soda|seltzer|sparkling water|club soda|mineral water|topo chico|kombucha/, CLEAR, 0, { fizz: true }),
  c(/^(water|still water|filtered water|ice|saline|saline solution|salt solution|salt|sea salt)$/, CLEAR, 0),

  // --- spirits ---
  c(/islay|peat|laphroaig|ardbeg|lagavulin|caol ila/, '#B07230', 0.6),
  c(/mezcal|sotol|raicilla|bacanora|tobal[aá]|espad[ií]n|tepeztate|ensamble/, CLEAR, 0.02),
  c(/blackstrap|black rum|navy rum|dark rum|demerara rum|overproof dark/, '#4E220A', 0.95),
  c(/a[nñ]ejo rum|aged rum|jamaican rum|gold rum|ron a[nñ]ejo|rum a[nñ]ejo/, '#9A5420', 0.6),
  c(/spiced rum/, '#8A4A18', 0.7),
  c(/reposado/, '#E3C27A', 0.3),
  c(/a[nñ]ejo|extra a[nñ]ejo/, '#C99A4E', 0.5),
  c(/tequila|blanco|agave spirit/, CLEAR, 0.02),
  c(/\brye\b/, '#A9561A', 0.7),
  c(/bourbon|tennessee|corn whiskey/, '#B5621C', 0.7),
  c(/japanese whisk|japanese malt/, '#D49A48', 0.55),
  c(/irish whisk/, '#C98A35', 0.55),
  c(/scotch|single malt|highland|speyside|blended malt/, '#C27C2C', 0.6),
  c(/whisk(e)?y|whisk\(e\)y/, '#B87430', 0.6),
  c(/cognac|armagnac|brandy|calvados|applejack|apple brandy/, '#A8581E', 0.75),
  c(/genever|old tom/, '#F0EAD2', 0.08),
  c(/sloe/, '#8A1838', 1),
  c(/\bgin\b|london dry|contemporary \/ new western/, CLEAR, 0.03),
  c(/agricole|cacha[cç]a|clairin|white rum|light rum|\brum\b|\bron\b|\brhum\b/, CLEAR, 0.03),
  c(/pisco|grappa|eau-de-vie|eau de vie|kirsch|vodka|aquavit|akvavit|shochu|soju|baijiu|awamori|arrack|sake/, CLEAR, 0.02),

  // --- coffee, tea and chocolate ---
  c(/espresso|cold brew|coffee/, '#2A190F', 1.2, { foam: 'crema' }),
  c(/matcha/, '#6E9E3A', 1, { cloudy: true }),
  c(/butterfly pea/, '#3A4FC8', 1.2),
  c(/hibiscus|jamaica|sorrel/, '#A0123A', 1),
  c(/green tea|jasmine tea|white tea/, '#D8D090', 0.3),
  c(/\btea\b|earl grey|lapsang|rooibos|chai/, '#A0582A', 0.7),
  c(/chocolate|cacao|cocoa/, '#4A2A1A', 1, { cloudy: true }),

  // --- dairy and coconut ---
  c(/coconut cream|cream of coconut|coco l[oó]pez|coconut milk/, '#F6F0E4', 1.2, { cloudy: true, foam: 'silk' }),
  c(/coconut water/, '#F2F0E6', 0.1),
  c(/cream|milk|half and half|yogh?urt|ice cream|butter|kefir/, '#F6EFDF', 1.4, { cloudy: true, foam: 'silk' }),

  // --- juices and acids ---
  c(/blood orange/, '#C8402E', 1, { cloudy: true }),
  c(/(lime|lemon|yuzu|calamansi|citrus) cordial/, '#E6E4A6', 0.35),
  c(/lime juice|^lime$|fresh lime/, '#D6E09A', 0.35, { cloudy: true, foam: 'sheen' }),
  c(/lemon juice|^lemon$|fresh lemon|yuzu|calamansi|citrus juice|^citrus$/, '#F0E3A0', 0.35, { cloudy: true, foam: 'sheen' }),
  c(/grapefruit/, '#F2B8A0', 0.35, { cloudy: true, foam: 'sheen' }),
  c(/orange juice|mandarin|clementine|tangerine|^orange$/, '#F2A33A', 0.8, { cloudy: true }),
  c(/pineapple/, '#EFCF62', 0.7, { cloudy: true, foam: 'froth' }),
  c(/cranberry/, '#B3122E', 1),
  c(/grenadine|pomegranate/, '#B0122C', 1.1),
  c(/passion ?fruit|maracuy[aá]/, '#E8B33A', 0.8, { cloudy: true }),
  c(/mango/, '#F2A93A', 0.9, { cloudy: true }),
  c(/guava|papaya/, '#F09A8A', 0.8, { cloudy: true }),
  c(/lychee|pear/, '#F2EED8', 0.2, { cloudy: true }),
  c(/apple juice|apple/, '#E8C46A', 0.4),
  c(/tomato|clamato/, '#C2301C', 1.2, { cloudy: true }),
  c(/watermelon/, '#F0606A', 0.8),
  c(/strawberr/, '#D8303E', 1),
  c(/raspberr/, '#C0174F', 1),
  c(/blackberr|black currant|blackcurrant|cassis/, '#4A0F33', 1.1),
  c(/blueberr/, '#3C2A6A', 1),
  c(/cherr/, '#8A1028', 1),
  c(/peach|apricot|nectarine/, '#F2B47A', 0.5, { cloudy: true }),
  c(/cucumber/, '#B8D49A', 0.3),
  c(/celery|kale|spinach|green juice/, '#7AA84A', 0.6),
  c(/beet/, '#8A1040', 1.2),
  c(/carrot/, '#E8782A', 0.9, { cloudy: true }),
  c(/verjus|vinegar/, '#EEE8C8', 0.2),
  c(/shrub/, '#C07A40', 0.6),
  c(/\bjuice\b|pur[eé]e|nectar/, '#E8B860', 0.6, { cloudy: true }),

  // --- syrups and sweeteners ---
  c(/orgeat|almond syrup/, '#F1E9D6', 0.5, { cloudy: true }),
  c(/maple/, '#B86A1E', 0.8),
  c(/honey/, '#E0A63A', 0.5),
  c(/demerara|rich (simple )?syrup|2:1|brown sugar|muscovado|panela|piloncillo/, '#C8873E', 0.4),
  c(/cinnamon|clove|nutmeg|allspice|spice syrup|chai syrup/, '#B87A3A', 0.5),
  c(/ginger (syrup|juice)/, '#D9B26A', 0.4, { cloudy: true }),
  c(/vanilla/, '#E8D4A8', 0.2),
  c(/agave (syrup|nectar)/, '#F0E0B0', 0.15),
  c(/sugar cube|\bsugar\b|simple syrup|gomme|1:1|\bsyrup\b/, '#F5F2EA', 0.02),

  // --- garnishes, herbs and aromas: no colour of their own ---
  c(/\bmint\b|basil|sage|rosemary|thyme|shiso|dill|tarragon|herb/, CLEAR, 0, { clear: true }),
  c(/peel|twist|zest|wheel|wedge|slice|olive|onion|cherry garnish|garnish|rim|dust|spray|mist|rinse/, CLEAR, 0, { clear: true }),
  c(/chil[ie]|jalape[nñ]o|habanero|tabasco|hot sauce|sriracha|cayenne|pepper|worcestershire/, '#C04020', 0.6),
];

export function colorRuleFor(line: Pick<SketchLine, 'name' | 'genericName' | 'categories'>): ColorRule | null {
  const texts = [line.name, line.genericName ?? '', ...(line.categories ?? [])].map((t) => t.trim().toLowerCase()).filter(Boolean);
  for (const text of texts) {
    const rule = COLOR_RULES.find((r) => r.match.test(text));
    if (rule) return rule;
  }
  return null;
}

// --- colour arithmetic ---
const HEX = /^#[0-9a-f]{6}$/i;
const hexToRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = (a: number[]) => '#' + a.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export const mixHex = (a: string, b: string, t: number) => rgbToHex(hexToRgb(a).map((v, i) => v + (hexToRgb(b)[i] - v) * t));
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round3 = (n: number) => Math.round(n * 1000) / 1000;
export const isHex = (s: unknown): s is string => typeof s === 'string' && HEX.test(s);

const CREAM = '#F6F0E2';

/**
 * The colours a finished drink can be, by name. The AI fill picks one of
 * these for a whole drink: asked for free hex, it answered pure black or
 * white for half the drinks it didn't know.
 */
export const DRINK_COLORS = {
  clear: CLEAR, pale_straw: '#EFE3B0', gold: '#E3B84A', amber: '#C98A35', copper: '#B0602A', brown: '#7A4420',
  dark_brown: '#3A2216', black: '#1E140E', ruby: '#9A1530', red: '#C42A36', pink: '#EE9AA6', blush: '#F2C0B8',
  coral: '#F08070', orange: '#F08A32', peach: '#F2B47A', yellow: '#EED45A', lime: '#B8D45A', green: '#6FA64A',
  mint: '#7CC48A', blue: '#3A6FC8', purple: '#7A4FA0', lilac: '#B8A0D8', creamy_white: '#F2EADA', milky_coffee: '#B89070',
} as const;
export type DrinkColor = keyof typeof DRINK_COLORS;
const DRINK_COLOR_NAMES = Object.keys(DRINK_COLORS) as DrinkColor[];
const DEFAULT_LIQUID = '#D8A050';

// Words in a description that name a colour, for drinks with no usable spec.
const COLOR_WORDS: readonly [RegExp, string][] = [
  [/\b(clear|crystal|transparent|colou?rless)\b/, CLEAR],
  [/\b(black|inky|jet)\b/, '#1E120C'],
  [/\b(ruby|crimson|scarlet|blood[- ]red|red)\b/, '#B8182E'],
  [/\b(pink|rose|blush|coral)\b/, '#EE9AA6'],
  [/\b(purple|violet|lilac|lavender)\b/, '#8D6BB4'],
  [/\bblue\b/, '#3A6FC8'],
  [/\b(green|emerald|verdant)\b/, '#86B23A'],
  [/\b(yellow|lemony)\b/, '#EED45A'],
  [/\borange\b(?! (bitters|peel|twist|zest|liqueur|juice|wheel))/, '#F08A32'],
  [/\b(amber|golden|gold|honeyed)\b/, '#D49A48'],
  [/\b(brown|mahogany|chocolate|coffee)\b/, '#5A3018'],
  [/\b(white|milky|creamy)\b/, '#F2EADA'],
];

// ---------------------------------------------------------------------------
// Hints from the drink's name and description
// ---------------------------------------------------------------------------

interface NameHint {
  match: RegExp;
  glass?: Glass;
  ice?: Ice;
  method?: Method;
  garnish?: Garnish;
}
// Classic families a name or description gives away. First match wins per field.
const NAME_HINTS: readonly NameHint[] = [
  // How it's served, said outright, beats any family guess.
  { match: /served up|straight up|\bup\b/, ice: 'none' },
  { match: /over crushed|crushed ice/, ice: 'crushed' },
  { match: /large cube|big cube|block of ice|clear ice|king cube/, ice: 'large' },
  { match: /ice spear|collins spear|\bspear\b/, ice: 'spear' },
  { match: /on the rocks|over ice|\biced\b/, ice: 'cubes' },
  { match: /espresso martini|coffee martini/, glass: 'martini', ice: 'none', method: 'shake', garnish: 'coffee_beans' },
  { match: /dirty martini|gibson/, glass: 'martini', ice: 'none', method: 'stir', garnish: 'olive' },
  { match: /\bmartini\b|vesper/, glass: 'martini', ice: 'none', method: 'stir', garnish: 'lemon_peel' },
  { match: /\bnegroni|boulevardier|americano\b/, glass: 'rocks', ice: 'large', method: 'stir', garnish: 'orange_peel' },
  { match: /old fashioned|sazerac/, glass: 'rocks', ice: 'large', method: 'stir', garnish: 'orange_peel' },
  { match: /manhattan|martinez|rob roy|vieux carr[eé]|brooklyn|tuxedo/, glass: 'nick', ice: 'none', method: 'stir', garnish: 'cherry' },
  { match: /daiquiri|gimlet|last word|aviation|clover club|white lady|sidecar|corpse reviver|bee'?s knees|southside/, glass: 'coupe', ice: 'none', method: 'shake' },
  { match: /margarita/, glass: 'coupe', ice: 'none', method: 'shake', garnish: 'salt_rim' },
  { match: /\bsour\b/, glass: 'rocks', ice: 'cubes', method: 'shake' },
  { match: /julep/, glass: 'julep', ice: 'crushed', method: 'build', garnish: 'mint' },
  { match: /mojito/, glass: 'highball', ice: 'cubes', method: 'build', garnish: 'mint' },
  { match: /swizzle/, glass: 'collins', ice: 'crushed', method: 'swizzle', garnish: 'mint' },
  { match: /zombie|mai ?tai|painkiller|jungle bird|tiki|navy grog|scorpion/, glass: 'tiki', ice: 'crushed', method: 'shake' },
  { match: /pi[nñ]a colada|frozen|slush|frappe|frapp[eé]/, glass: 'collins', ice: 'shaved', method: 'blend', garnish: 'pineapple' },
  { match: /mule|buck\b/, glass: 'mug', ice: 'cubes', method: 'build', garnish: 'lime_wedge' },
  { match: /irish coffee|hot toddy|toddy|grog|hot buttered|mulled|\bhot\b/, glass: 'mug', ice: 'none', method: 'build' },
  { match: /french 75|bellini|mimosa|kir royale|champagne cocktail|seelbach/, glass: 'flute', ice: 'none', method: 'build' },
  { match: /spritz|sbagliato/, glass: 'spritz', ice: 'cubes', method: 'build', garnish: 'orange_wheel' },
  { match: /collins|tom collins|john collins/, glass: 'collins', ice: 'cubes', method: 'build', garnish: 'lemon_wheel' },
  { match: /\bfizz\b|ramos/, glass: 'fizz', ice: 'none', method: 'shake' },
  { match: /highball|paloma|cuba libre|dark (and|'n'|&) stormy|gin (and|&) tonic|g&t|\bmule\b|rickey|cooler/, glass: 'highball', ice: 'cubes', method: 'build' },
  { match: /flip|alexander|grasshopper|brandy alexander/, glass: 'coupe', ice: 'none', method: 'shake' },
  { match: /bloody mary|bloody maria|caesar/, glass: 'highball', ice: 'cubes', method: 'build', garnish: 'cucumber' },
  { match: /cobbler|smash/, glass: 'rocks', ice: 'crushed', method: 'shake', garnish: 'berries' },
  { match: /punch/, glass: 'rocks', ice: 'large', method: 'build' },
];

const GARNISH_UNITS = new Set(['peel', 'twist', 'wheel', 'slice', 'sprig', 'leaf', 'leaves', 'wedge', 'zest', 'piece', 'pieces', 'whole', 'each', 'garnish', 'spray', 'rim']);

const GARNISH_RULES: readonly [RegExp, Garnish][] = [
  [/orange (peel|twist|zest|oil)|expressed orange/, 'orange_peel'],
  [/grapefruit (peel|twist|zest|oil)/, 'grapefruit_peel'],
  [/lemon (peel|twist|zest|oil)|expressed lemon/, 'lemon_peel'],
  [/lime (wheel|slice)/, 'lime_wheel'],
  [/lemon (wheel|slice)/, 'lemon_wheel'],
  [/orange (wheel|slice|half)/, 'orange_wheel'],
  [/lime wedge|lime/, 'lime_wedge'],
  [/coffee bean/, 'coffee_beans'],
  [/cherr/, 'cherry'],
  [/olive/, 'olive'],
  [/onion/, 'onion'],
  [/\bmint\b/, 'mint'],
  [/basil|rosemary|thyme|sage|shiso|dill|tarragon|herb|bay leaf|curry leaf/, 'herb'],
  [/strawberr/, 'strawberry'],
  [/raspberr|blackberr|blueberr|berr|currant/, 'berries'],
  [/pineapple/, 'pineapple'],
  [/nutmeg|cinnamon|grated|cocoa dust|cacao dust|dust/, 'grated_spice'],
  [/flower|edible|orchid|petal|viola|blossom|marigold/, 'flower'],
  [/cucumber/, 'cucumber'],
  [/salt rim|salted rim|tajin|tajín|chili salt|rim of salt/, 'salt_rim'],
  [/sugar rim|sugared rim/, 'sugar_rim'],
  [/ginger/, 'ginger'],
  [/chil[ie]|pepper/, 'chili'],
  [/apple/, 'apple'],
  [/lemon/, 'lemon_wheel'],
  [/orange/, 'orange_peel'],
];

const isGarnishLine = (l: SketchLine) => {
  const unit = (l.unit ?? '').trim().toLowerCase();
  if (GARNISH_UNITS.has(unit)) return true;
  if (/juice|syrup|liqueur|cordial|soda|bitters|cream|water|purée|puree|shrub/.test(l.name.toLowerCase())) return false;
  return /peel|twist|zest|wheel|wedge|sprig|leaf|garnish|cherry|cherries|olive|coffee bean|flower|petal|rim\b|grated|dusted/.test(l.name.toLowerCase());
};

// ---------------------------------------------------------------------------
// The drink
// ---------------------------------------------------------------------------

/**
 * A drink's drawing inputs. Never throws: a drink with nothing known still
 * gets a sensible glass and a neutral colour, marked 'default'.
 */
export function sketchFromDrink(drink: SketchDrink): SketchResult {
  const text = `${drink.name} ${drink.description ?? ''}`.toLowerCase();
  // The name first: a description can mention other drinks and bottles ("Martini Bitter").
  const hint = <K extends keyof NameHint>(k: K): NameHint[K] | undefined => {
    for (const t of [drink.name.toLowerCase(), (drink.description ?? '').toLowerCase()]) {
      const found = NAME_HINTS.find((h) => h.match.test(t) && h[k] !== undefined);
      if (found) return found[k];
    }
    return undefined;
  };
  const ai = drink.ai ?? null;
  let usedAi = false;

  // --- liquid ---
  let r = 0, g = 0, b = 0, w = 0, vol = 0, known = 0, cloudy = false, fizz = false;
  let float: string | null = null;
  let bleed: string | null = null;
  const foams: Foam[] = [];
  const unknown: SketchLine[] = [];
  let garnish: Garnish | null = null;

  for (const line of drink.lines) {
    const rule = colorRuleFor(line);
    const look = rule ? null : line.look ?? null;
    if (!rule && look) usedAi = true;
    const unit = (line.unit ?? '').trim().toLowerCase();
    const lname = line.name.toLowerCase();

    if (!garnish && isGarnishLine(line)) garnish = first(GARNISH_RULES, `${line.name} ${unit}`);
    if (rule?.clear || (line.volume <= 0 && !rule && !look)) continue;
    if (!rule && !look) {
      unknown.push(line);
      vol += line.volume;
      continue;
    }
    const hex = rule ? rule.hex : look!.color;
    const tint = rule ? rule.tint : clamp01(look!.tint);
    if (rule?.fizz && line.volume > 0) fizz = true;
    const foam = rule ? rule.foam : look!.foam ?? undefined;
    if (foam && !(foam === 'sheen' && line.volume < 10) && !(foam === 'froth' && line.volume < 15)) foams.push(foam);
    if (rule?.cloudy && tint > 0.2) cloudy = true;

    if (unit === 'float' || /\bfloat(ed)?\b/.test(lname)) { float = hex; known += line.volume; vol += line.volume; continue; }
    if (unit === 'drizzle' || /drizzle/.test(lname)) { bleed = hex; known += line.volume; vol += line.volume; continue; }

    vol += line.volume;
    known += line.volume;
    const ws = line.volume * tint;
    const [cr, cg, cb] = hexToRgb(hex);
    r += cr * ws; g += cg * ws; b += cb * ws; w += ws;
  }

  const coverage = vol > 0 ? round3(known / vol) : 0;
  let liquidFrom: Source = 'rules';
  let hex: string;
  let alpha: number;
  if (w > 0 && coverage >= 0.5) {
    hex = rgbToHex([r / w, g / w, b / w]);
    alpha = Math.min(1, Math.max(0.14, (w / Math.max(vol, 1)) * 1.7));
  } else if (known > 0 && w === 0 && coverage >= 0.5) {
    // Everything known is clear: a gin and tonic.
    hex = CLEAR;
    alpha = 0.14;
  } else if (ai?.color && isHex(ai.color)) {
    hex = ai.color.toLowerCase();
    alpha = hex === CLEAR.toLowerCase() ? 0.14 : 0.75;
    liquidFrom = 'ai';
    usedAi = true;
  } else {
    const word = first(COLOR_WORDS, drink.description ?? '') ?? first(COLOR_WORDS, drink.name);
    hex = word ?? (w > 0 ? rgbToHex([r / w, g / w, b / w]) : DEFAULT_LIQUID);
    alpha = word === CLEAR ? 0.14 : 0.7;
    liquidFrom = word || w > 0 ? 'rules' : 'default';
  }
  if (cloudy) {
    hex = mixHex(hex, CREAM, 0.22);
    alpha = 1;
  }

  // --- method, glass, ice ---
  const has = (re: RegExp) => drink.lines.some((l) => re.test(`${l.name} ${l.genericName ?? ''}`.toLowerCase()));
  const citrus = has(/lime|lemon|grapefruit|yuzu|citrus|juice|egg|cream|pineapple|pur[eé]e/);
  const topped = fizz || has(/top|soda|tonic|ginger beer|ginger ale|sparkling|champagne|prosecco|cola|beer/);
  const total = drink.lines.reduce((s, l) => s + l.volume, 0);

  let method: Method | null = methodFromNames(drink.methods);
  let methodFrom: Source = method ? 'data' : 'rules';
  if (!method) method = hint('method') ?? null;
  if (!method && drink.lines.length) method = topped ? 'build' : citrus ? 'shake' : 'stir';
  if (!method && ai?.method) { method = ai.method; methodFrom = 'ai'; usedAi = true; }
  if (!method) { method = 'stir'; methodFrom = 'default'; }

  let glass: Glass | null = glassFromName(drink.glass);
  let glassFrom: Source = glass ? 'data' : 'rules';
  if (!glass) {
    const said = /(?:served |poured )?in an? ([a-z&' -]{3,30}?)(?: glass)?(?:[,.;]|$| with| over| on)/.exec((drink.description ?? '').toLowerCase());
    if (said) glass = glassFromName(said[1]);
  }
  if (!glass) glass = hint('glass') ?? null;
  if (!glass && ai?.glass) { glass = ai.glass; glassFrom = 'ai'; usedAi = true; }
  if (!glass && drink.lines.length) {
    if (method === 'swizzle') glass = 'collins';
    else if (method === 'blend') glass = 'collins';
    else if (topped && has(/champagne|prosecco|cava|sparkling wine|cr[eé]mant/) && total < 150) glass = 'flute';
    else if (topped) glass = total > 160 ? 'collins' : 'highball';
    else if (method === 'stir') glass = 'nick';
    else if (method === 'shake') glass = total > 130 ? 'rocks' : 'coupe';
    else glass = 'rocks';
  }
  if (!glass) { glass = 'rocks'; glassFrom = 'default'; }

  let ice: Ice | null = iceFromName(drink.ice);
  let iceFrom: Source = ice ? 'data' : 'rules';
  if (!ice) ice = hint('ice') ?? null;
  if (!ice && ai?.ice && glassFrom !== 'data') { ice = ai.ice; iceFrom = 'ai'; usedAi = true; }
  if (!ice) {
    const up: Glass[] = ['coupe', 'nick', 'martini', 'flute', 'snifter', 'beer', 'wine'];
    if (up.includes(glass)) ice = 'none';
    else if (glass === 'julep' || glass === 'tiki' || glass === 'ceramic' || method === 'swizzle') ice = 'crushed';
    else if (glass === 'rocks') ice = method === 'stir' ? 'large' : 'cubes';
    else if (glass === 'mug') ice = /hot|toddy|coffee|grog|mulled/.test(text) ? 'none' : 'cubes';
    else if (method === 'blend') ice = 'shaved';
    else ice = 'cubes';
  }

  // --- foam: the method decides whether, the strongest agent what kind ---
  let foam: Foam | null = null;
  if ((method === 'shake' || method === 'blend') && !float) {
    for (const f of FOAMS) if (foams.includes(f)) { foam = f; break; }
    if (!foam && method === 'blend') foam = 'froth';
  }
  if (!foam && foams.includes('cap') && topped && /stout|guinness|beer/.test(text + drink.lines.map((l) => l.name).join(' ').toLowerCase())) foam = 'cap';
  if (!foam && !drink.lines.length && ai?.foam) { foam = ai.foam; usedAi = true; }
  if (ice === 'crushed' || ice === 'pebble' || ice === 'shaved') foam = null;

  // --- garnish: a spec line, then the description, then the name, then the AI fill ---
  let garnishFrom: Source = garnish ? 'data' : 'rules';
  if (!garnish) {
    const said = /garnish(?:ed)? with ([^.;]+)/.exec(drink.description ?? '');
    if (said) garnish = first(GARNISH_RULES, said[1]);
  }
  if (!garnish) garnish = hint('garnish') ?? null;
  if (!garnish && ai?.garnish) { garnish = ai.garnish; garnishFrom = 'ai'; usedAi = true; }

  const askDrink = !glassFromName(drink.glass) && (!drink.lines.length || coverage < 0.5 || !hint('glass'));

  return {
    inputs: {
      v: SKETCH_VERSION,
      glass,
      ice,
      method,
      liquid: { hex: hex.toLowerCase(), alpha: round3(alpha) },
      foam,
      float: float?.toLowerCase() ?? null,
      bleed: bleed?.toLowerCase() ?? null,
      fizz: fizz || (topped && method === 'build'),
      garnish,
      from: { glass: glassFrom, ice: iceFrom, method: methodFrom, liquid: liquidFrom, garnish: garnish ? garnishFrom : 'default' },
      coverage,
    },
    unknown,
    askDrink,
    usedAi,
  };
}

// ---------------------------------------------------------------------------
// The AI fill
// ---------------------------------------------------------------------------

/** Extra lines for the flavor-worker's AI prompt: what each ingredient looks like, and the drink as a whole when asked. */
export function sketchPromptAddendum(drink: SketchDrink | null): string[] {
  const out = [
    'Besides those numbers, give each ingredient: color, the liquid\'s colour as poured as "#rrggbb"; tint, 0 to 1, how strongly it colours a drink (0 for a clear spirit or syrup, 1 for Campari or espresso);',
    `and foam, one of ${FOAMS.join(', ')} if shaking it makes that kind of foam (egg white: cap, espresso: crema, pineapple: froth, cream: silk, citrus: sheen), else null.`,
  ];
  if (drink) {
    out.push(
      'Also add a "drink" object describing how this drink is served:',
      `{"glass": one of ${GLASSES.join(', ')}; "ice": one of ${ICES.join(', ')}; "method": one of ${METHODS.join(', ')};`,
      `"garnish": one of ${GARNISHES.join(', ')} or null; "color": the finished drink's colour, one of ${DRINK_COLOR_NAMES.join(', ')}`,
      '(pick the closest real colour from its ingredients and style; clear for colourless drinks); '
        + `"foam": one of ${FOAMS.join(', ')} or null}.`,
      'Judge from the name, description and ingredients, the way a bartender would serve it.',
      `Drink: ${JSON.stringify({ name: drink.name, description: (drink.description ?? '').slice(0, 600), ingredients: drink.lines.map((l) => l.name).slice(0, 20) })}`,
    );
  }
  return out;
}

const pick = <T extends string>(list: readonly T[], v: unknown): T | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return (list as readonly string[]).includes(t) ? (t as T) : undefined;
};
/** A colour as '#rrggbb', from '#RRGGBB' or '#rgb'. */
const hexOf = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(t)) return t;
  if (/^#[0-9a-f]{3}$/.test(t)) return '#' + [...t.slice(1)].map((c) => c + c).join('');
  return undefined;
};

/** A drink colour from its name; a bare hex is kept unless it's the pure black or white the model falls back to. */
const drinkColorOf = (v: unknown): string | undefined => {
  const name = pick(DRINK_COLOR_NAMES, v);
  if (name) return DRINK_COLORS[name].toLowerCase();
  const hex = hexOf(v);
  return hex && hex !== '#000000' && hex !== '#ffffff' ? hex : undefined;
};

/**
 * The shape the model must answer in (Gemini's responseSchema), so every
 * enum comes back from its list. Taste dimensions come from flavor.ts.
 */
export function aiAnswerSchema(tasteDimensions: readonly string[], withDrink: boolean): Record<string, unknown> {
  const str = (values?: readonly string[], nullable = false) => ({ type: 'STRING', ...(values ? { enum: [...values] } : {}), ...(nullable ? { nullable: true } : {}) });
  const num = { type: 'NUMBER' };
  const ingredient = {
    type: 'OBJECT',
    properties: {
      id: str(), abv: num, ...Object.fromEntries(tasteDimensions.map((d) => [d, num])),
      color: str(), tint: num, foam: str(FOAMS, true),
    },
    required: ['id', 'abv', ...tasteDimensions, 'color', 'tint'],
  };
  const drink = {
    type: 'OBJECT',
    properties: {
      glass: str(GLASSES), ice: str(ICES), method: str(METHODS), garnish: str(GARNISHES, true), color: str(DRINK_COLOR_NAMES), foam: str(FOAMS, true),
    },
    required: ['glass', 'ice', 'method', 'color'],
  };
  return {
    type: 'OBJECT',
    properties: { ingredients: { type: 'ARRAY', items: ingredient }, ...(withDrink ? { drink } : {}) },
    required: withDrink ? ['ingredients', 'drink'] : ['ingredients'],
  };
}

/** Reads the colour half of the AI fill's answer per asked id. Anything off-list is dropped. */
export function parseAiLooks(text: string, askedIds: readonly string[]): Map<string, IngredientLook> {
  const out = new Map<string, IngredientLook>();
  let data: unknown;
  try { data = JSON.parse(text); } catch { return out; }
  const rows = (data as { ingredients?: unknown })?.ingredients;
  if (!Array.isArray(rows)) return out;
  const asked = new Set(askedIds);
  for (const row of rows as Record<string, unknown>[]) {
    const id = typeof row?.id === 'string' ? row.id : null;
    const color = hexOf(row.color);
    if (!id || !asked.has(id) || out.has(id) || !color) continue;
    const tint = typeof row.tint === 'number' && Number.isFinite(row.tint) ? round3(clamp01(row.tint)) : 0.3;
    out.set(id, { color, tint, foam: pick(FOAMS, row.foam) ?? null });
  }
  return out;
}

/** Reads the drink half of the AI fill's answer. Only listed values survive. */
export function parseAiDrink(text: string): DrinkLook | null {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return null; }
  const d = (data as { drink?: Record<string, unknown> })?.drink;
  if (!d || typeof d !== 'object') return null;
  // Near misses ("Coupe glass", "large cube") are read the way the drink's own data is.
  const said = (v: unknown) => (typeof v === 'string' ? v : '');
  const look: DrinkLook = {
    glass: pick(GLASSES, d.glass) ?? glassFromName(said(d.glass)) ?? undefined,
    ice: pick(ICES, d.ice) ?? iceFromName(said(d.ice)) ?? undefined,
    method: pick(METHODS, d.method) ?? methodFromNames([said(d.method)]) ?? undefined,
    garnish: pick(GARNISHES, d.garnish) ?? (said(d.garnish) ? first(GARNISH_RULES, said(d.garnish)) : null),
    color: drinkColorOf(d.color),
    foam: pick(FOAMS, d.foam) ?? null,
  };
  return look.glass || look.ice || look.method || look.color ? look : null;
}
