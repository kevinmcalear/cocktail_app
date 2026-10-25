import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption } from '@/components/ds';
import { GlasswarePrompt } from '@/components/screens/venue/GlasswarePrompt';
import { space } from '@/constants/tokens';
import type { BarGlass } from '@/hooks/useBarGlassware';
import { sketchLook, type StepProps, type WizardPick } from '@/lib/drinkWizard';
import { glassTitle, isVenueGlassName } from '@/lib/glassware';
import { draftSketchInputs } from '@/lib/sketch/draft';
import { variantsOf } from '@/lib/sketch/geometry';
import { glassFromName } from '@/supabase/functions/_shared/sketch';

import { PickStep } from './PickStep';
import { ShapeTiles } from './ShapeTiles';
import { Eyebrow } from './WizardChrome';

interface GlassStepProps extends StepProps {
  options: WizardPick[];
  /** The venue the drink is added at, for "Is this one of your glasses?"; null at home. */
  barId?: string | null;
  /** The venue's glassware (bar_glassware): its glass of this type is marked, and drawn until another is picked. */
  barGlasses?: readonly BarGlass[];
  barVariants: readonly string[];
  /** Our guess from the spec, while no glass is picked. */
  suggested?: string | null;
  /** The desktop page's row: four glasses, then More. */
  compact?: boolean;
}

/**
 * The glass, then "Which shape?": the drink sketched in each of the bar's own
 * glasses of that type, by their names; a bar with none of that type gets
 * every shape (lib/sketch/geometry.ts GLASS_VARIANTS). Then a field for
 * another glass. The sketch at the top redraws with the
 * pick. Saved as items.sketch_variant, and a shape that is one of the bar's
 * real glasses as items.glass_model_id. At a venue, its own glasses are
 * listed first, and a glass it doesn't list yet asks to be added.
 */
export function GlassStep({ draft, set, options, barId, barGlasses, barVariants, suggested, compact }: GlassStepProps) {
  // Stable while the drink is: the tiles' drawings are cached by this object.
  const key = JSON.stringify(sketchLook(draft, barVariants));
  const inputs = useMemo(() => draftSketchInputs(JSON.parse(key)), [key]);
  const list = variantsOf(inputs.glass);
  // The bar's own glasses of this type, one tile per shape (its main glass first when two share one).
  const own = (barGlasses ?? [])
    .filter((g) => g.glass === inputs.glass)
    .sort((a, b) => Number(b.is_default) - Number(a.is_default))
    .map((g) => ({ key: g.variant ?? list[0].key, label: glassTitle(g), modelId: g.model_id }))
    .filter((g, i, all) => all.findIndex((x) => x.key === g.key) === i);
  // A shape that is one of the bar's real glasses saves that glass too.
  const modelOf = (key: string) => own.find((g) => g.key === key)?.modelId ?? null;
  const shapes = own.length ? own : list;
  const shown = inputs.variant ?? list[0].key;
  // Only a glass we can name is asked about: an unknown one is drawn as a guess.
  const picked = glassFromName(draft.glass?.name) === inputs.glass ? inputs.glass : null;
  const venueGlasses = barId && barGlasses?.length ? barGlasses : null;
  return (
    <PickStep
      label="Glass"
      ownLabel="Another glass"
      options={options}
      selected={draft.glass ? [draft.glass] : []}
      suggested={suggested}
      compact={compact}
      // A shape belongs to its glass: one of the bar's own glasses by name is that glass; else the bar's main one (or the default).
      onChange={([glass]) => {
        const mine = barGlasses?.find((g) => g.name && g.name.trim().toLowerCase() === glass?.name.trim().toLowerCase());
        set({ glass: glass ?? null, glassVariant: mine?.variant ?? null, glassModelId: mine?.model_id ?? null });
      }}
      mine={venueGlasses ? { has: (p) => isVenueGlassName(venueGlasses, p.name), label: 'Your glasses', restLabel: 'Other glasses' } : undefined}
    >
      {draft.glass && (own.length || list.length > 1) ? (
        <View style={styles.shapes}>
          <Eyebrow>Which shape?</Eyebrow>
          <ShapeTiles shapes={shapes} inputs={inputs} seed="new-drink" value={shown} onChange={(glassVariant) => set({ glassVariant, glassModelId: modelOf(glassVariant) })} />
          <Caption tone="muted">{`The sketch ${compact ? 'on the right' : 'at the top'} redraws in the shape you pick.`}</Caption>
        </View>
      ) : null}
      {draft.glass ? <GlasswarePrompt barId={barId} glass={picked} variant={inputs.variant} name={draft.glass.name} drink={draft.name} /> : null}
    </PickStep>
  );
}

const styles = StyleSheet.create({
  shapes: { gap: space.md, paddingTop: space.sm },
});
