// A drink's drawing inputs, as the flavor-worker stores them in item_sketches
// and as the add-drink wizard works them out live (lib/sketch/draft.ts). The
// lists come from the rules both run (supabase/functions/_shared/sketchRules.ts).
import { SKETCH_CLEAR_TINT } from '../../constants/sketch';
import { FOAMS, GARNISHES, GLASSES, ICES, METHODS, readIceLook, sketchBuild, type IceLook, type SketchLayer } from '../../supabase/functions/_shared/sketchRules';

export type { IceLook, SketchLayer };
export { readIceLook };

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
  /**
   * The colour the drink's editor picked ('#rrggbb', constants/sketch.ts
   * SKETCH_TINTS) over the one in liquid, which stays the worker's. Set by the
   * database from items.sketch_liquid; missing or null is Auto. Painted
   * through liquidOf.
   */
  tint?: string | null;
  /**
   * The venue's own ice in place of a guessed one (lib/venueKit.ts houseIce).
   * Set by the database from the venue's Ice list; a stored row reads back
   * with it in "ice".
   */
  houseIce?: SketchIce | null;
  /**
   * How the ice sits, bottom first (lib/iceBuild.ts), painted layer by layer
   * over "ice". Set by the database from items.ice_build; missing is one ice.
   */
  build?: SketchLayer[] | null;
  /**
   * The one ice's look when there is no build (a build's layers carry their
   * own): size in mm, clear or cloudy, a stamp, something frozen inside.
   * Missing draws as before.
   */
  iceLook?: IceLook | null;
  /**
   * The glass's real height, rim to foot, mm (glass_models.height_mm), for
   * drawing ice sizes to scale. Missing is a usual glass of its kind
   * (lib/sketch/geometry.ts GLASS_MM).
   */
  glassMm?: number | null;
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
    // The venue's ice over a guessed one, as the database worked it out.
    ice: has(SKETCH_ICES, x.houseIce) && x.houseIce !== 'none' ? x.houseIce : x.ice,
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
    // Only when there is one: Auto rows read back as they were stored.
    ...(isHex(x.tint) ? { tint: x.tint.toLowerCase() } : {}),
    ...(readBuild(x.build) ? { build: readBuild(x.build) } : {}),
    ...(readIceLook(x.iceLook) ? { iceLook: readIceLook(x.iceLook) } : {}),
    ...(typeof x.glassMm === 'number' && x.glassMm >= 40 && x.glassMm <= 400 ? { glassMm: x.glassMm } : {}),
  };
}

/** A stored build, kept only as far as this app can paint it. */
function readBuild(raw: unknown): SketchLayer[] | null {
  if (!Array.isArray(raw)) return null;
  const named = raw.filter((l) => l && typeof l === 'object' && has(SKETCH_ICES, l.kind) && l.kind !== 'none').map((l) => ({ ...l, name: String(l.kind) }));
  return sketchBuild(named);
}

/**
 * The colour a drink is painted: its editor's tint over the worker's colour.
 * A tint keeps the drink's strength unless that was clear (then it's a
 * colour now), and the clear swatch paints thin, as a clear drink. Takes raw
 * rows too (the link previews paint stored inputs as they are).
 */
export function liquidOf(inputs: Pick<SketchInputs, 'liquid' | 'tint'>): SketchInputs['liquid'] {
  const tint = isHex(inputs.tint) ? inputs.tint.toLowerCase() : null;
  if (!tint) return inputs.liquid;
  return { hex: tint, alpha: tint === SKETCH_CLEAR_TINT ? 0.14 : Math.max(inputs.liquid.alpha, 0.75) };
}

/** The same drawing with another tint, or Auto (null): what the picker previews and the cache holds until the row comes back. */
export const withTint = (inputs: SketchInputs, tint: string | null): SketchInputs => ({ ...inputs, tint });
