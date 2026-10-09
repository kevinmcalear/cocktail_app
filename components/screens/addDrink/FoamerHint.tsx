import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Headline, useDs } from '@/components/ds';
import { FoamPicker } from '@/components/techniques/FoamPicker';
import { TechniqueSheet } from '@/components/techniques/TechniqueSheet';
import { radius, space } from '@/constants/tokens';
import { newLine, pickByName, type WizardDraft } from '@/lib/drinkWizard';
import { needsFoamer } from '@/lib/techniques/foamPicker';

import type { CatalogIngredient } from './IngredientSearch';

interface Props {
  draft: WizardDraft;
  set: (change: Partial<WizardDraft>) => void;
  ingredients: readonly CatalogIngredient[];
}

/** On the method step: a dry shake with nothing that foams offers the foam picker, which adds the foamer to the spec. */
export function FoamerHint({ draft, set, ingredients }: Props) {
  const ds = useDs();
  const [open, setOpen] = useState(false);
  if (!needsFoamer(draft.methods.map((m) => m.name), draft.lines.map((l) => l.name))) return null;
  return (
    <View role="note" style={[styles.card, { backgroundColor: ds.c.raised }]}>
      <Headline>A dry shake needs something that foams</Headline>
      <Body tone="muted">Nothing in this spec does yet. Egg white, aquafaba or a few foamer drops will.</Body>
      <Button label="Pick a foamer" onPress={() => setOpen(true)} style={styles.start} />
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
