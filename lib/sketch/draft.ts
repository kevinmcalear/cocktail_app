// The drawing inputs for a drink that isn't saved yet: the add-drink wizard
// redraws its sketch from these on every step. Same rules the flavor-worker
// runs after a save (supabase/functions/_shared/sketchRules.ts), without the
// AI fill, so a drink looks the same before and after it's saved unless the
// AI knows something the rules don't.
import { partWeight } from '../../supabase/functions/_shared/flavor';
import { sketchFromDrink } from '../../supabase/functions/_shared/sketchRules';

import type { SketchInputs } from './types';

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
  methods?: readonly string[];
  lines: readonly DraftLine[];
}

export function draftSketchInputs(draft: DraftLook): SketchInputs {
  return sketchFromDrink({
    name: draft.name,
    description: draft.description ?? null,
    glass: draft.glass ?? null,
    ice: draft.ice ?? null,
    methods: draft.methods ?? [],
    lines: draft.lines.map((l) => ({
      id: null,
      name: l.name,
      genericName: l.genericName ?? null,
      amount: l.amount,
      unit: l.unit,
      volume: partWeight({ name: l.name, amount: l.amount, unit: l.unit }).volume,
    })),
  }).inputs;
}
