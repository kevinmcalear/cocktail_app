/**
 * Glass kinds first (owner-setup step 6, call 9): setup offers kinds, and a
 * kind on its own is a glass with no model, "any coupe" (a bar_glassware row
 * with model_id null). The real glass is optional and comes after. A kind
 * drawn as a variant ("Double rocks") keeps its name on the row.
 * Checked by lib/glassKinds.check.ts.
 */
import { GLASS_TYPE_LABEL } from '@/lib/glassware';
import type { SketchGlass } from '@/lib/sketch/types';

export interface GlassKind {
  key: string;
  glass: SketchGlass;
  /** A lib/sketch/geometry.ts variant of the glass; null is its plain drawing. */
  variant: string | null;
  label: string;
  /** "Any coupe": how the list says a glass of this kind with no model. */
  any: string;
}

const kind = (glass: SketchGlass, label: string, any: string, variant: string | null = null): GlassKind => ({ key: variant ?? glass, glass, variant, label, any });

/** The kinds setup offers, in the board's order ("Something else" names your own). */
export const SETUP_KINDS: readonly GlassKind[] = [
  kind('coupe', 'Coupe', 'Any coupe'),
  kind('nick', 'Nick & Nora', 'Any Nick & Nora'),
  kind('martini', 'Martini', 'Any martini glass'),
  kind('rocks', 'Rocks', 'Any rocks glass'),
  kind('rocks', 'Double rocks', 'Any double rocks glass', 'rocks_double'),
  kind('highball', 'Highball', 'Any highball'),
  kind('collins', 'Collins', 'Any Collins glass'),
  kind('flute', 'Flute', 'Any flute'),
  kind('wine', 'Wine', 'Any wine glass'),
  kind('tiki', 'Tiki mug', 'Any tiki mug'),
  kind('mug', 'Copper mug', 'Any copper mug', 'mug_copper'),
];

type Drawn = { glass: SketchGlass; variant: string | null };

/** The kind a glass sits under: its variant's own kind ("Double rocks"), else its glass's plain kind. Null for a glass setup doesn't offer. */
export function kindOf(g: Drawn): GlassKind | null {
  return SETUP_KINDS.find((k) => k.glass === g.glass && k.variant !== null && k.variant === g.variant) ?? SETUP_KINDS.find((k) => k.glass === g.glass && k.variant === null) ?? null;
}

/** A kind on its own: no model, no maker, the variant kind's name kept ("Double rocks"). The first of its glass is the main one. */
export function kindRow(k: GlassKind, have: readonly { glass: SketchGlass; is_default: boolean }[]) {
  return {
    glass: k.glass,
    variant: k.variant,
    name: k.variant ? k.label : null,
    maker: null,
    maker_profile_id: null,
    designer: null,
    series: null,
    shape_note: null,
    model_id: null,
    is_default: !have.some((g) => g.glass === k.glass && g.is_default),
  };
}

/** "Any coupe" for a glass with no model; the kinds setup doesn't offer say their type ("Any snifter"). */
export function anyLine(g: Drawn): string {
  return kindOf(g)?.any ?? `Any ${GLASS_TYPE_LABEL[g.glass].toLowerCase()}`;
}
