// The drawing inputs for a drink that isn't saved yet: the add-drink wizard
// redraws its sketch from these on every step. Same rules the flavor-worker
// runs after a save (supabase/functions/_shared/sketchRules.ts), without the
// AI fill, so a drink looks the same before and after it's saved unless the
// AI knows something the rules don't.
import { partWeight } from '../../supabase/functions/_shared/flavor';
import { sketchBuild, sketchFromDrink } from '../../supabase/functions/_shared/sketchRules';

import { houseIce } from '../venueKit';

import type { IceLook, SketchInputs } from './types';

export interface DraftLine {
  name: string;
  /** The generic ingredient's name ("Gin" for "Tanqueray"), when known. */
  genericName?: string | null;
  amount: number | null;
  unit: string | null;
}

export interface DraftLook {
  name: string;
  description?: string | null;
  /** Item names, as picked: "Coupe", "Large cube", ["Shake", "Top"]. */
  glass?: string | null;
  ice?: string | null;
  /** Their kinds when the items say (items.glass, items.ice_kind), or as picked for a new one: used before the names. */
  glassKind?: string | null;
  iceKind?: string | null;
  methods?: readonly string[];
  lines: readonly DraftLine[];
  /** The glass drawing picked ('martini_pony', lib/sketch/geometry.ts); counts only for the glass it's drawn in. */
  variant?: string | null;
  /** The bar's own glasses' drawings, for when nothing is picked (bar_glassware). */
  barVariants?: readonly string[];
  /** The venue's ice kinds ('cubes', 'large'), for when the ice is only guessed (item_ice). */
  barIce?: readonly string[];
  /** How the ice sits, bottom first, by name and kind (lib/iceBuild.ts); `ice` is its top layer. */
  build?: readonly ({ name: string; kind?: string | null; n?: number | null; to?: string | null } & IceLook)[] | null;
  /** The one ice's look and the glass's height, mm, when the venue's ice and glass say (types.ts SketchInputs). */
  iceLook?: IceLook | null;
  glassMm?: number | null;
  /** The colour picked for the drawing, or Auto (null): painted over the spec's own (types.ts liquidOf). */
  tint?: string | null;
}

export function draftSketchInputs(draft: DraftLook): SketchInputs {
  const { inputs } = sketchFromDrink({
    name: draft.name,
    description: draft.description ?? null,
    glass: draft.glass ?? null,
    ice: draft.ice ?? null,
    glassKind: draft.glassKind ?? null,
    iceKind: draft.iceKind ?? null,
    methods: draft.methods ?? [],
    lines: draft.lines.map((l) => ({
      id: null,
      name: l.name,
      genericName: l.genericName ?? null,
      amount: l.amount,
      unit: l.unit,
      volume: partWeight({ name: l.name, amount: l.amount, unit: l.unit }).volume,
    })),
  });
  // As the database resolves it after a save: the pick, else the bar's glass of this type.
  const forGlass = (v: string | null | undefined) => (v?.startsWith(`${inputs.glass}_`) ? v : null);
  const variant = forGlass(draft.variant) ?? (draft.barVariants ?? []).map(forGlass).find(Boolean) ?? null;
  // And its ice: a guessed one gives way to the venue's nearest kind.
  const ice = inputs.from.ice === 'data' ? null : houseIce(inputs.ice, draft.barIce ?? []);
  const build = sketchBuild(draft.build);
  return {
    ...inputs, ice: ice ?? inputs.ice, variant, ...(build ? { build } : {}), ...(draft.tint ? { tint: draft.tint } : {}),
    ...(draft.iceLook ? { iceLook: draft.iceLook } : {}), ...(draft.glassMm ? { glassMm: draft.glassMm } : {}),
  };
}

/** A bare glass, by its name or icon key ("Martini"): what a drink with no drawing yet shows, in place of a line icon. */
export function bareGlassSketch(glass: string | null | undefined): SketchInputs {
  const inputs = draftSketchInputs({ name: '', glass: glass || 'Coupe', lines: [] });
  return { ...inputs, ice: 'none', foam: null, float: null, bleed: null, fizz: false, garnish: null, liquid: { hex: inputs.liquid.hex, alpha: 0 } };
}
