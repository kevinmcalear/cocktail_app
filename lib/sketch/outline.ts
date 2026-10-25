// A real glass's outline, traced from a product photo and scaled to its
// height (glass_models.outline, loaded by scripts/glass-outlines.ts), and the
// reader that checks a stored one. Millimetres, measured down from the rim.
// The database copies it into a drink's drawing inputs (SketchInputs).

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
