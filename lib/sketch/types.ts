// A drink's drawing inputs, as the flavor-worker stores them in item_sketches
// (supabase/functions/_shared/sketch.ts, which lib/sketch/sketch.check.ts
// keeps in step with these lists).

export const SKETCH_GLASSES = [
  'coupe', 'nick', 'martini', 'rocks', 'highball', 'collins', 'fizz', 'flute',
  'wine', 'spritz', 'snifter', 'julep', 'tiki', 'mug', 'ceramic', 'beer',
] as const;
export const SKETCH_ICES = ['none', 'cubes', 'large', 'spear', 'crushed', 'pebble', 'shaved', 'sphere'] as const;
export const SKETCH_METHODS = ['shake', 'stir', 'build', 'blend', 'swizzle', 'throw', 'pour'] as const;
export const SKETCH_FOAMS = ['cap', 'crema', 'froth', 'silk', 'sheen'] as const;
export const SKETCH_GARNISHES = [
  'orange_peel', 'lemon_peel', 'grapefruit_peel', 'lime_wheel', 'lemon_wheel', 'orange_wheel', 'lime_wedge',
  'cherry', 'olive', 'onion', 'mint', 'herb', 'berries', 'strawberry', 'pineapple', 'coffee_beans',
  'grated_spice', 'flower', 'cucumber', 'salt_rim', 'sugar_rim', 'ginger', 'chili', 'apple',
] as const;

export type SketchGlass = (typeof SKETCH_GLASSES)[number];
export type SketchIce = (typeof SKETCH_ICES)[number];
export type SketchFoam = (typeof SKETCH_FOAMS)[number];
export type SketchGarnish = (typeof SKETCH_GARNISHES)[number];

export interface SketchInputs {
  v: number;
  glass: SketchGlass;
  ice: SketchIce;
  method: (typeof SKETCH_METHODS)[number];
  liquid: { hex: string; alpha: number };
  foam: SketchFoam | null;
  float: string | null;
  bleed: string | null;
  fizz: boolean;
  garnish: SketchGarnish | null;
  from: Record<'glass' | 'ice' | 'method' | 'liquid' | 'garnish', 'data' | 'rules' | 'ai' | 'default'>;
  coverage: number;
}

const has = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);
const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

/** Reads a stored row's inputs, or null if it isn't something this app can draw (an older or newer shape). */
export function readSketchInputs(raw: unknown): SketchInputs | null {
  const x = raw as Partial<SketchInputs> | null;
  if (!x || typeof x !== 'object') return null;
  if (!has(SKETCH_GLASSES, x.glass) || !has(SKETCH_ICES, x.ice) || !has(SKETCH_METHODS, x.method)) return null;
  if (!x.liquid || !isHex(x.liquid.hex) || typeof x.liquid.alpha !== 'number') return null;
  return {
    v: Number(x.v) || 1,
    glass: x.glass,
    ice: x.ice,
    method: x.method,
    liquid: { hex: x.liquid.hex.toLowerCase(), alpha: Math.min(1, Math.max(0.05, x.liquid.alpha)) },
    foam: has(SKETCH_FOAMS, x.foam) ? x.foam : null,
    float: isHex(x.float) ? x.float : null,
    bleed: isHex(x.bleed) ? x.bleed : null,
    fizz: x.fizz === true,
    garnish: has(SKETCH_GARNISHES, x.garnish) ? x.garnish : null,
    from: (x.from ?? {}) as SketchInputs['from'],
    coverage: Number(x.coverage) || 0,
  };
}
