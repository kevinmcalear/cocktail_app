import { StyleSheet, View } from 'react-native';

import { Caption } from '@/components/ds';
import { space } from '@/constants/tokens';
import { GARNISH_CHIPS, newLine, pickByName, type StepProps, type WizardLine } from '@/lib/drinkWizard';

import { OwnField } from './PickStep';
import { WizardChip } from './WizardChrome';

type Ingredient = { id: string; name: string | null };

const same = (l: WizardLine, name: string, unit: string) => l.name.toLowerCase() === name.toLowerCase() && l.unit === unit;

/**
 * Garnishes are spec lines with a count unit (1 orange peel, 1 mint sprig),
 * the way specs already write them, so the batch maths, Service and the
 * sketch all read them as garnish.
 */
export function GarnishStep({ draft, set, ingredients }: StepProps & { ingredients: readonly Ingredient[] }) {
  const own = draft.garnishes.filter((l) => !GARNISH_CHIPS.some((c) => same(l, c.name, c.unit)));
  const toggle = (name: string, unit: string, amount: string) => {
    const on = draft.garnishes.find((l) => same(l, name, unit));
    set({ garnishes: on ? draft.garnishes.filter((l) => l !== on) : [...draft.garnishes, newLine(pickByName(name, ingredients), unit, amount)] });
  };
  return (
    <View style={styles.stack}>
      <View role="group" accessibilityLabel="Garnishes" style={styles.chips}>
        {GARNISH_CHIPS.map((c) => (
          <WizardChip key={c.label} kind="checkbox" label={c.label} selected={draft.garnishes.some((l) => same(l, c.name, c.unit))} onPress={() => toggle(c.name, c.unit, c.amount)} />
        ))}
        {own.map((l) => (
          <WizardChip key={l.key} kind="checkbox" label={l.name} selected onPress={() => toggle(l.name, l.unit, l.amount)} />
        ))}
      </View>
      <OwnField label="Something else" placeholder="Dehydrated lime, smoked salt…" onAdd={(name) => toggle(name, 'each', '1')} />
      <Caption tone="muted">Garnishes go at the end of the spec.</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
