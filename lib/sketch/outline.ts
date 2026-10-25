// A real glass's outline, traced from a product photo and scaled to its
// height (glass_models.outline, loaded by scripts/glass-outlines.ts), and the
// reader that checks a stored one. Millimetres, measured down from the rim.
// The database copies it into a drink's drawing inputs (SketchInputs), and
// the painter draws it in place of the family's shape: the family
// (GLASS_SHAPES) still gives the liquid line, the base and the finish.

import { GLASS_SHAPES, type GlassShape, type Pt } from './geometry';
import type { IceLook, SketchGlass, SketchIce } from './types';

/** Not clear glass: what it's made of, in the colour of the maker's photo. */
export interface GlassMaterial {
  /** tinted: coloured see-through glass; metal: steel, copper, pewter; ceramic: glazed clay or porcelain. */
  kind: 'tinted' | 'metal' | 'ceramic';
  color: string;
  /** Beaten metal, whose little facets catch the light. */
  hammered?: boolean;
}

export interface GlassOutline {
  height_mm: number;
  rim_mm: number;
  widest_mm: number;
  stemmed: boolean;
  /** [depth below the rim, diameter], rim to the bottom of the bowl (or of a tumbler). */
  outline: [number, number][];
  /** Stemmed: where the bowl meets the stem, where the foot starts, and their traced profiles. */
  bowl_mm?: number | null;
  stem_to_mm?: number | null;
  stem_mm?: number | null;
  foot_mm?: number | null;
  stem_profile?: [number, number][] | null;
  foot_profile?: [number, number][] | null;
  /** Tumblers: how thick the solid base is, when it was measured. */
  base_mm?: number | null;
  /** Not clear glass: from the maker's words, coloured from the photo. */
  material?: GlassMaterial | null;
  sleeve?: { from_mm: number; to_mm: number; color: string; weave: boolean } | null;
  handle?: { from_mm: number; to_mm: number; reach_mm: number } | null;
}

const pairs = (v: unknown, min: number): v is [number, number][] =>
  Array.isArray(v) && v.length >= min && v.every((p) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n < 1000));
const mm = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1000 ? v : null);
// A depth below the rim, the rim itself included.
const depth = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1000;
const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

/** A stored outline, or null if it isn't one this app can draw. */
export function readOutline(raw: unknown): GlassOutline | null {
  const x = raw as Partial<GlassOutline> | null;
  if (!x || typeof x !== 'object') return null;
  const height = mm(x.height_mm);
  const widest = mm(x.widest_mm);
  if (!height || !widest || !pairs(x.outline, 3)) return null;
  const stemmed = x.stemmed === true;
  if (stemmed && (!mm(x.bowl_mm) || !mm(x.stem_to_mm))) return null;
  const m = x.material;
  const material = m && (m.kind === 'tinted' || m.kind === 'metal' || m.kind === 'ceramic') && isHex(m.color) ? { kind: m.kind, color: m.color, hammered: m.hammered === true } : null;
  const s = x.sleeve;
  const h = x.handle;
  return {
    height_mm: height,
    rim_mm: mm(x.rim_mm) ?? widest,
    widest_mm: widest,
    stemmed,
    outline: x.outline,
    bowl_mm: mm(x.bowl_mm),
    stem_to_mm: mm(x.stem_to_mm),
    stem_mm: mm(x.stem_mm),
    foot_mm: mm(x.foot_mm),
    stem_profile: pairs(x.stem_profile, 2) ? x.stem_profile : null,
    foot_profile: pairs(x.foot_profile, 2) ? x.foot_profile : null,
    base_mm: mm(x.base_mm),
    material,
    sleeve: s && depth(s.from_mm) && mm(s.to_mm) && isHex(s.color) ? { from_mm: s.from_mm, to_mm: s.to_mm, color: s.color, weave: s.weave === true } : null,
    handle: h && depth(h.from_mm) && mm(h.to_mm) && mm(h.reach_mm) ? { from_mm: h.from_mm, to_mm: h.to_mm, reach_mm: h.reach_mm } : null,
  };
}

const GROUND = 87;
// One scale for every glass, so a rocks glass stays shorter than a highball; tall ones shrink to fit.
const PER_MM = 74 / 170;

/** The painter's shape for a traced glass. */
export function shapeFromOutline(glass: SketchGlass, o: GlassOutline): GlassShape {
  let t = GLASS_SHAPES[glass];
  if (t.stemmed !== o.stemmed) t = GLASS_SHAPES[o.stemmed ? 'coupe' : 'rocks'];
  const u = Math.min(PER_MM, 74 / o.height_mm, 56 / o.widest_mm);
  const y = (d: number) => GROUND - (o.height_mm - d) * u;
  const half = (pts: [number, number][]): Pt[] => pts.map(([d, dia]) => [y(d), Math.max(0.35, (dia / 2) * u)]);
  const rim = y(0);
  const prof = half(o.outline);
  const tBot = t.prof[t.prof.length - 1][0];
  const m = o.material ?? null;
  const finish: Partial<GlassShape> = {
    material: m ?? undefined,
    // Clear glass unless the maker and the photo say otherwise, and no stock tiki face.
    opaque: m && m.kind !== 'tinted' ? m.color : undefined,
    face: false,
    handle: o.handle ? false : t.handle,
    handleAt: o.handle ? { from: y(o.handle.from_mm), to: y(o.handle.to_mm), reach: o.handle.reach_mm * u } : undefined,
    sleeve: o.sleeve ? { from: y(o.sleeve.from_mm), to: y(o.sleeve.to_mm), color: o.sleeve.color, weave: o.sleeve.weave } : undefined,
  };
  if (o.stemmed && o.bowl_mm && o.stem_to_mm) {
    const bowlBot = y(o.bowl_mm);
    prof.push([bowlBot + 0.3, 0]);
    return {
      ...t,
      ...finish,
      rim,
      prof,
      stemmed: true,
      top: rim + ((t.top - t.rim) / (tBot - t.rim)) * (bowlBot - rim),
      stem: [bowlBot, Math.max(bowlBot + 1, y(o.stem_to_mm))],
      foot: [GROUND, ((o.foot_mm ?? o.widest_mm * 0.8) / 2) * u],
      stemW: Math.max(0.55, ((o.stem_mm ?? 6) / 2) * u),
      stemProf: o.stem_profile ? half(o.stem_profile) : undefined,
      // A foot only widens toward the table: a reflection that dips the trace is smoothed out.
      footProf: o.foot_profile ? half(o.foot_profile).map(([fy], i, f): Pt => [fy, Math.max(...f.slice(0, i + 1).map((q) => q[1]))]) : undefined,
    };
  }
  const span = tBot - t.rim;
  const base = o.base_mm ? GROUND - Math.min(o.base_mm, o.height_mm * 0.45) * u : rim + ((t.base! - t.rim) / span) * (GROUND - rim);
  return { ...t, ...finish, rim, prof, stemmed: false, top: rim + ((t.top - t.rim) / span) * (GROUND - rim), base };
}

// A traced glass is drawn to scale, so its ice is too: usual sizes, mm across,
// where the venue gave none (a 30 mm cube, a 50 mm block, a 60 mm sphere).
const USUAL_ICE_MM: Partial<Record<SketchIce, number>> = { cubes: 30, large: 50, spear: 30, sphere: 60 };

/** The ice's look in a traced glass: its own size if it has one, else the usual size of that kind of piece. */
export function tracedIce<T extends IceLook>(kind: SketchIce, look: T | null): T | IceLook | null {
  const mm = USUAL_ICE_MM[kind];
  return look?.mm || !mm ? look : { ...look, mm };
}
