import { useMemo } from 'react';

import { barVariants, useBarGlassware } from '@/hooks/useBarGlassware';
import { useSpecCatalog } from '@/hooks/useBulk';
import { useDropdowns } from '@/hooks/useDropdowns';
import type { DrinkToMake } from '@/hooks/useBringInSave';
import { isPrepName } from '@/lib/bringIn';
import { livePick, recipeDraft, type MadeBatches, type RecipeChoices } from '@/lib/bringInDraft';
import type { MatchData } from '@/lib/bringInMatch';
import { sketchLook } from '@/lib/drinkWizard';
import { drinkRecipe } from '@/lib/readBatch';
import { draftSketchInputs } from '@/lib/sketch/draft';
import type { SketchInputs } from '@/lib/sketch/types';
import type { RecipeReading } from '@/supabase/functions/_shared/anythingRead';
import { useSettingsStore } from '@/store/useSettingsStore';

/** Turns a checked recipe into the drink to save: the wizard draft, its preps, and the drawing it was checked with. */
export function useRecipeMaker(data: MatchData) {
  const usual = useSettingsStore((s) => s.defaultUnit) || 'ml';
  const { methods, glasses } = useSpecCatalog();
  const ice = (useDropdowns().data?.iceTypes ?? []).flatMap((i: { id: string; name: string | null }) => (i.name ? [{ id: i.id, name: i.name }] : []));
  // The bar's own glass drawings, as the wizard draws with.
  const variants = barVariants(useBarGlassware(data.venueId).data);
  /** `made`: batches an earlier drink of the same import saved, which this one uses instead of making again. */
  const toMake = (r: RecipeReading, c: RecipeChoices, made: MadeBatches = {}): DrinkToMake => {
    const draft = recipeDraft(r, c, data, { methods, glasses, ice }, usual, made);
    // Saved as drawn here, so the drink keeps the drawing the check showed.
    const picked = livePick(c);
    const updateId = picked?.as === 'update' ? picked.id : null;
    const prepNames = drinkRecipe(r, c).lines.filter((l) => isPrepName(l.ingredient)).map((l) => l.ingredient);
    // The batch this save makes, so a later drink pouring it can use it.
    const batch = r.batch && draft.lines.some((l) => l.batch) ? { key: r.batch.key, name: r.batch.name } : undefined;
    return { draft, prepNames, sketch: draftSketchInputs(sketchLook(draft, variants)), updateId, ...(batch ? { batch } : {}) };
  };
  return { usual, toMake };
}

/** One inputs object per look: SketchDrawing keeps its painted scene by it. */
export function useSteadySketch(inputs: SketchInputs | undefined): SketchInputs {
  const key = JSON.stringify(inputs ?? null);
  return useMemo(() => JSON.parse(key) as SketchInputs, [key]);
}
