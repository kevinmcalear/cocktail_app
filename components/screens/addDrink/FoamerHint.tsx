import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Headline, useDs } from '@/components/ds';
import { FoamPicker } from '@/components/techniques/FoamPicker';
import { TechniqueSheet } from '@/components/techniques/TechniqueSheet';
import { radius, space } from '@/constants/tokens';
import { newLine, pickByName, type WizardDraft } from '@/lib/drinkWizard';
import { needsFoamer } from '@/lib/techniques/foamPicker';
import { prepFacts } from '@/lib/techniques/template';

import type { CatalogIngredient } from './IngredientSearch';

interface Props {
  draft: WizardDraft;
  set: (change: Partial<WizardDraft>) => void;
  ingredients: readonly CatalogIngredient[];
}

/**
 * On the method step: a dry shake with nothing that foams offers the foam
 * picker, which adds the foamer to the spec. A spec that's vegan so far
 * (read from its lines) steers away from egg white.
 */
export function FoamerHint({ draft, set, ingredients }: Props) {
  const ds = useDs();
  const [open, setOpen] = useState(false);
  const names = draft.lines.map((l) => l.name);
  if (!needsFoamer(draft.methods.map((m) => m.name), names)) return null;
  const vegan = names.length > 0 && prepFacts(names).vegan === true;
  return (
    <View role="note" style={[styles.card, { backgroundColor: ds.c.raised }]}>
      <Headline>A dry shake needs something that foams</Headline>
      <Body tone="muted">
        {vegan
          ? 'Nothing in this spec foams yet. It’s vegan so far, so egg white is out: try aquafaba or a few foamer drops.'
          : 'Nothing in this spec foams yet. Egg white, aquafaba or a few foamer drops will.'}
      </Body>
      <Button label="Pick a foamer" variant="secondary" onPress={() => setOpen(true)} style={styles.start} />
      <TechniqueSheet visible={open} onClose={() => setOpen(false)} eyebrow="Foam" title="Pick a foamer">
        <FoamPicker
          kind="shaken"
          onUse={(a) => {
            const pick = pickByName(a.ingredient, ingredients);
            const line = newLine(pick, a.perDrink!.unit, a.perDrink!.amount);
            // Not on the shelf yet: the sour syrup comes in as a house prep with its steps.
            if (!pick.id && a.id === 'mc-syrup') line.technique = a.technique;
            set({ lines: [...draft.lines, line] });
            setOpen(false);
          }}
        />
      </TechniqueSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
  start: { alignSelf: 'flex-start' },
});
