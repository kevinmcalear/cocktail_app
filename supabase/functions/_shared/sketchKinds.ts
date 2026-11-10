/**
 * The kinds a drink drawing is made of (glass, ice, method, foam, garnish), an
 * ice's look, and the name rules for glassware and ice: the small part of
 * sketchRules.ts that every drawing needs, kept apart so the app's first
 * load can draw a glass without carrying the colour rules (B13). Pure
 * TypeScript with no imports, run by the flavor-worker, the app and the checks.
 */

/** The rules' version (sketchRules.ts): bump it when they change, then re-queue drinks with private.enqueue_item_flavors() so stored inputs follow. */
export const SKETCH_VERSION = 2;

export const GLASSES = [
  'coupe', 'nick', 'martini', 'rocks', 'highball', 'collins', 'fizz', 'flute',
  'wine', 'spritz', 'snifter', 'julep', 'tiki', 'mug', 'ceramic', 'beer', 'shot', 'cordial',
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

/**
 * What a venue knows about one ice, so the drawing can show it as it is
 * (Kit and ice, step 10). Every field is optional and a missing one draws as
 * before. Only pieces use them (cubes, large, spear, sphere); loose ice
 * ignores them.
 */
export interface IceLook {
  /** Across one piece, mm: a cube's side, a sphere's diameter, a spear's or Collins block's width. Drawn to scale against the glass. */
  mm?: number;
  /** A spear's or Collins block's length, mm. */
  lengthMm?: number;
  /** True for clear ice, false for cloudy (a white core); missing draws as before. */
  clear?: boolean;
  /** A stamp pressed into the top face. */
  stamp?: boolean;
  /** Something frozen inside (a flower, a slice of citrus), drawn as a small prism. */
  inside?: boolean;
}

/** One layer of ice in the glass, bottom first, as the drawing paints it (lib/iceBuild.ts), with what the venue knows about that ice. */
export interface SketchLayer extends IceLook {
  kind: Exclude<Ice, 'none'>;
  /** Pieces: how many. */
  n?: number;
  /** Loose ice: how high. */
  to?: 'half' | 'rim' | 'mound';
}

const mmIn = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v) : undefined);

/** An ice's look as far as it makes sense, or null when it says nothing: sizes in range, flags only when said. */
export function readIceLook(raw: unknown): IceLook | null {
  if (!raw || typeof raw !== 'object') return null;
  const x = raw as Record<string, unknown>;
  const look: IceLook = {
    ...(mmIn(x.mm, 5, 120) ? { mm: mmIn(x.mm, 5, 120) } : {}),
    ...(mmIn(x.lengthMm, 20, 300) ? { lengthMm: mmIn(x.lengthMm, 20, 300) } : {}),
    ...(typeof x.clear === 'boolean' ? { clear: x.clear } : {}),
    ...(x.stamp === true ? { stamp: true } : {}),
    ...(x.inside === true ? { inside: true } : {}),
  };
  return Object.keys(look).length ? look : null;
}

/**
 * A drink's ice build in the drawing's words, from each layer's ice (its kind,
 * else its name); a layer it can't name is left out. Null when nothing's left. The database
 * does the same for saved drinks (private.ice_build_kinds,
 * 20261029500000_ice_builds.sql).
 */
export function sketchBuild(layers: readonly ({ name: string; kind?: string | null; n?: number | null; to?: string | null } & IceLook)[] | null | undefined): SketchLayer[] | null {
  const out: SketchLayer[] = [];
  for (const l of layers ?? []) {
    const kind = itemIce(l);
    if (!kind || kind === 'none') continue;
    // The ice's look rides along when the layer has one (venue ice, lib/sketch/types.ts IceLook).
    out.push({ kind, ...(l.n ? { n: Math.min(12, Math.max(1, Math.round(l.n))) } : {}), ...(l.to === 'half' || l.to === 'rim' || l.to === 'mound' ? { to: l.to } : {}), ...readIceLook(l) });
  }
  return out.length ? out.slice(0, 6) : null;
}

// Specific before general. Matched against lowercased glassware names.
const GLASS_NAMES: readonly [RegExp, Glass][] = [
  // A small stemmed glass for liqueurs, and a shot glass (d66, 27 Oct): before
  // the shapes their names share a word with ("Pony shot", "Shot tumbler").
  [/cordial|liqueur|chartreuse glass|pousse/, 'cordial'],
  [/\bshots?\b|shooter|caballito|veladora/, 'shot'],
  [/nick|nora|pony/, 'nick'],
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
  // First: "No ice" has "ice" in it, which would read as cubes. So do "no-ice", "without ice" and "ice-free".
  [/\bno[\s-]*ice\b|\bwithout (?:any )?ice\b|\bw\/o ice\b|\bice[\s-]?free\b|^none\b|^neat\b|^up\b|\bserved up\b/, 'none'],
  [/crush|cracked|frapp/, 'crushed'],
  [/pebble|nugget|pellet|sonic/, 'pebble'],
  [/shaved|snow|kakig[oō]ri/, 'shaved'],
  [/spear|collins ice|column/, 'spear'],
  [/sphere|ball/, 'sphere'],
  [/large|big|king|block|single|clear cube|rock\b/, 'large'],
  // "Hosh": a bar's word for cubes from its Hoshizaki machine (Eddie, 26 Oct).
  [/cube|ice|\bhosh/, 'cubes'],
  [/none/, 'none'],
];

/** The first value whose pattern the lowercased text matches, or null. */
export const first = <T>(table: readonly [RegExp, T][], text: string | null | undefined): T | null => {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return null;
  for (const [re, v] of table) if (re.test(t)) return v;
  return null;
};

export const glassFromName = (name: string | null | undefined) => first(GLASS_NAMES, name);
export const iceFromName = (name: string | null | undefined) => first(ICE_NAMES, name);

/**
 * A glass or ice item, or free text. An item's kind (items.glass,
 * items.ice_kind, or a wizard pick's `kind`) beats its name: the name rules
 * only read text, and an item that doesn't say (null is not sure).
 */
export type Kinded = string | { name?: string | null; kind?: string | null; glass?: string | null; ice_kind?: string | null } | null | undefined;
const listed = <T extends string>(list: readonly T[], v: string | null | undefined): T | null => ((list as readonly string[]).includes(v ?? '') ? (v as T) : null);
const textOf = (x: Kinded) => (typeof x === 'object' ? x?.name : x);
export const itemGlass = (x: Kinded): Glass | null => (typeof x === 'object' && x ? listed(GLASSES, x.kind ?? x.glass) : null) ?? glassFromName(textOf(x));
export const itemIce = (x: Kinded): Ice | null => (typeof x === 'object' && x ? listed(ICES, x.kind ?? x.ice_kind) : null) ?? iceFromName(textOf(x));

/**
 * The colours a finished drink can be, by name. The AI fill picks one of
 * these for a whole drink: asked for free hex, it answered pure black or
 * white for half the drinks it didn't know.
 */
export const DRINK_COLORS = {
  clear: '#F2F2EC', pale_straw: '#EFE3B0', gold: '#E3B84A', amber: '#C98A35', copper: '#B0602A', brown: '#7A4420',
  dark_brown: '#3A2216', black: '#1E140E', ruby: '#9A1530', red: '#C42A36', pink: '#EE9AA6', blush: '#F2C0B8',
  coral: '#F08070', orange: '#F08A32', peach: '#F2B47A', yellow: '#EED45A', lime: '#B8D45A', green: '#6FA64A',
  mint: '#7CC48A', blue: '#3A6FC8', purple: '#7A4FA0', lilac: '#B8A0D8', creamy_white: '#F2EADA', milky_coffee: '#B89070',
} as const;
export type DrinkColor = keyof typeof DRINK_COLORS;
export const DRINK_COLOR_NAMES = Object.keys(DRINK_COLORS) as DrinkColor[];
