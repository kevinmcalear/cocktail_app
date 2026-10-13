import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption } from '@/components/ds';
import { GlasswarePrompt } from '@/components/screens/venue/GlasswarePrompt';
import { space } from '@/constants/tokens';
import type { BarGlass } from '@/hooks/useBarGlassware';
import { sketchLook, type StepProps, type WizardPick } from '@/lib/drinkWizard';
import { isVenueGlassName } from '@/lib/glassware';
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
}

/**
 * The glass, then "Which shape?": that glass's shapes side by side as line
 * drawings (lib/sketch/geometry.ts GLASS_VARIANTS), the bar's own marked,
 * then a field for another glass. The sketch at the top redraws with the
 * pick. Saved as items.sketch_variant. At a venue, its own glasses are
 * listed first, and a glass it doesn't list yet asks to be added.
 */
export function GlassStep({ draft, set, options, barId, barGlasses, barVariants, suggested }: GlassStepProps) {
  // Stable while the drink is: the tiles' drawings are cached by this object.
  const key = JSON.stringify(sketchLook(draft, barVariants));
  const inputs = useMemo(() => draftSketchInputs(JSON.parse(key)), [key]);
  const list = variantsOf(inputs.glass);
  const barGlass = barGlasses?.find((g) => g.glass === inputs.glass && g.is_default) ?? null;
  const notes = barGlass ? { [barGlass.variant ?? list[0].key]: barGlass.bar_name ? `${barGlass.bar_name} uses this` : 'Your bar uses this' } : undefined;
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
      // A shape belongs to its glass: a new glass starts from the bar's (or the default).
      onChange={([glass]) => set({ glass: glass ?? null, glassVariant: null })}
      mine={venueGlasses ? { has: (p) => isVenueGlassName(venueGlasses, p.name), label: 'Your glasses', restLabel: 'Other glasses' } : undefined}
    >
      {draft.glass && list.length > 1 ? (
        <View style={styles.shapes}>
          <Eyebrow>Which shape?</Eyebrow>
          <ShapeTiles shapes={list} value={list.find((x) => x.key === inputs.variant)?.key ?? list[0].key} onChange={(glassVariant) => set({ glassVariant })} notes={notes} />
          <Caption tone="muted">The sketch at the top redraws in the shape you pick.</Caption>
        </View>
      ) : null}
      {draft.glass ? <GlasswarePrompt barId={barId} glass={picked} variant={inputs.variant} name={draft.glass.name} /> : null}
    </PickStep>
  );
}

const styles = StyleSheet.create({
  shapes: { gap: space.md, paddingTop: space.sm },
});
