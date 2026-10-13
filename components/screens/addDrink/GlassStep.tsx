import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption } from '@/components/ds';
import { space } from '@/constants/tokens';
import type { BarGlass } from '@/hooks/useBarGlassware';
import { sketchLook, type StepProps, type WizardPick } from '@/lib/drinkWizard';
import { draftSketchInputs } from '@/lib/sketch/draft';
import { variantsOf } from '@/lib/sketch/geometry';

import { PickStep } from './PickStep';
import { ShapeTiles } from './ShapeTiles';
import { Eyebrow } from './WizardChrome';

interface GlassStepProps extends StepProps {
  options: WizardPick[];
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
 * pick. Saved as items.sketch_variant.
 */
export function GlassStep({ draft, set, options, barGlasses, barVariants, suggested }: GlassStepProps) {
  // Stable while the drink is: the tiles' drawings are cached by this object.
  const key = JSON.stringify(sketchLook(draft, barVariants));
  const inputs = useMemo(() => draftSketchInputs(JSON.parse(key)), [key]);
  const list = variantsOf(inputs.glass);
  const barGlass = barGlasses?.find((g) => g.glass === inputs.glass && g.is_default) ?? null;
  const notes = barGlass ? { [barGlass.variant ?? list[0].key]: barGlass.bar_name ? `${barGlass.bar_name} uses this` : 'Your bar uses this' } : undefined;
  return (
    <PickStep
      label="Glass"
      ownLabel="Another glass"
      options={options}
      selected={draft.glass ? [draft.glass] : []}
      suggested={suggested}
      // A shape belongs to its glass: a new glass starts from the bar's (or the default).
      onChange={([glass]) => set({ glass: glass ?? null, glassVariant: null })}
    >
      {draft.glass && list.length > 1 ? (
        <View style={styles.shapes}>
          <Eyebrow>Which shape?</Eyebrow>
          <ShapeTiles shapes={list} value={list.find((x) => x.key === inputs.variant)?.key ?? list[0].key} onChange={(glassVariant) => set({ glassVariant })} notes={notes} />
          <Caption tone="muted">The sketch at the top redraws in the shape you pick.</Caption>
        </View>
      ) : null}
    </PickStep>
  );
}

const styles = StyleSheet.create({
  shapes: { gap: space.md, paddingTop: space.sm },
});
