// A drink's drawing inputs, as the flavor-worker stores them in item_sketches
// and as the add-drink wizard works them out live (lib/sketch/draft.ts). The
// lists come from the rules both run (supabase/functions/_shared/sketchRules.ts).
import { FOAMS, GARNISHES, GLASSES, ICES, METHODS } from '../../supabase/functions/_shared/sketchRules';

export const SKETCH_GLASSES = GLASSES;
export const SKETCH_ICES = ICES;
export const SKETCH_METHODS = METHODS;
export const SKETCH_FOAMS = FOAMS;
export const SKETCH_GARNISHES = GARNISHES;

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
  /**
   * Which drawing of the glass ('martini_pony', lib/sketch/geometry.ts
   * GLASS_VARIANTS): the drink's own pick, else its bar's glassware. Set by the
   * database, not the worker; null draws the default.
   */
  variant: string | null;
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
    variant: typeof x.variant === 'string' && x.variant.startsWith(`${x.glass}_`) ? x.variant : null,
  };
}
