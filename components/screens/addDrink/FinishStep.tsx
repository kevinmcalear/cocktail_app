import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption } from '@/components/ds';
import { space } from '@/constants/tokens';
import {
  FINISH_CHIPS, finishLabel, finishStart, GARNISH_CHIPS, newLine, pickByName, type FinishChip, type StepProps, type WizardLine,
} from '@/lib/drinkWizard';

import type { CatalogIngredient } from './IngredientSearch';
import { OwnField } from './PickStep';
import { Eyebrow, WizardChip } from './WizardChrome';

interface FinishStepProps extends StepProps {
  ingredients: readonly CatalogIngredient[];
}

const same = (l: WizardLine, name: string, unit: string) => l.name.toLowerCase() === name.toLowerCase() && l.unit === unit;
/** On top of the drink (drops, a mist, a rinse, a float), not on the glass. */
const ON_TOP = /^(drop|dash|spray|rinse|float)$/;

/**
 * Any garnish: drops, a mist, a rinse or a float on top, the garnishes as
 * chips, and a field for something else. Each is a spec line after the
 * ingredients in its own unit (3 drops, a peel), the way Service and the
 * batch read a garnish. A chip that asks "of what?" (drops of oil) turns
 * the field into its question.
 */
export function FinishStep({ draft, set, ingredients }: FinishStepProps) {
  // A chip that asks "of what?": its unit waits for what's typed in the field.
  const [asking, setAsking] = useState<FinishChip | null>(null);
  const lines = draft.garnishes;

  const toggle = (name: string, unit: string, amount: string) => {
    const on = lines.find((l) => same(l, name, unit));
    set({ garnishes: on ? lines.filter((l) => l !== on) : [...lines, newLine(pickByName(name, ingredients), unit, amount)] });
  };
  const has = (name: string, unit: string) => lines.some((l) => same(l, name, unit));
  const addOwn = (name: string) => {
    const start = asking ?? finishStart(name);
    if (!has(name, start.unit)) set({ garnishes: [...lines, newLine(pickByName(name, ingredients), start.unit, start.amount)] });
    setAsking(null);
  };
  // Lines no chip stands for (your own, or a classic's): checked chips of their own, tap to take off.
  const chipped = (l: WizardLine) => GARNISH_CHIPS.some((c) => same(l, c.name, c.unit)) || FINISH_CHIPS.some((c) => !!c.name && same(l, c.name, c.unit));
  const own = lines.filter((l) => !chipped(l));
  const ownChip = (l: WizardLine) => (
    <WizardChip key={l.key} kind="checkbox" label={finishLabel(l)} selected onPress={() => set({ garnishes: lines.filter((x) => x.key !== l.key) })} />
  );

  return (
    <View style={styles.stack}>
      <View style={styles.group}>
        <Eyebrow>Drops, mist, rinse</Eyebrow>
        <View role="group" accessibilityLabel="Drops, mist, rinse" style={styles.chips}>
          {own.filter((l) => ON_TOP.test(l.unit)).map(ownChip)}
          {FINISH_CHIPS.map((c) => (
            <WizardChip
              key={c.label}
              kind="checkbox"
              label={c.label}
              selected={c.name ? has(c.name, c.unit) : asking?.label === c.label}
              onPress={() => (c.name ? toggle(c.name, c.unit, c.amount) : setAsking(asking?.label === c.label ? null : c))}
            />
          ))}
        </View>
      </View>
      <View style={styles.group}>
        <Eyebrow>Garnish</Eyebrow>
        <View role="group" accessibilityLabel="Garnishes" style={styles.chips}>
          {own.filter((l) => !ON_TOP.test(l.unit)).map(ownChip)}
          {GARNISH_CHIPS.map((c) => (
            <WizardChip key={c.label} kind="checkbox" label={c.label} selected={has(c.name, c.unit)} onPress={() => toggle(c.name, c.unit, c.amount)} />
          ))}
        </View>
      </View>
      <OwnField
        // A new key focuses the field when a chip asks "of what?".
        key={asking?.label ?? 'own'}
        label={asking?.ask ?? 'Something else'}
        placeholder={asking ? undefined : 'Dehydrated lime, smoked salt…'}
        autoFocus={!!asking}
        onAdd={addOwn}
      />
      <Caption tone="muted">Garnishes go at the end of the spec.</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
