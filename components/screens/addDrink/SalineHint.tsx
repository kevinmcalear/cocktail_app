import { StyleSheet, View } from 'react-native';

import { Button, Caption, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { pickByName, type WizardLine } from '@/lib/drinkWizard';
import { isLooseSalt } from '@/lib/unitGuess';

import type { CatalogIngredient } from './IngredientSearch';

interface Props {
  line: WizardLine;
  ingredients: readonly CatalogIngredient[];
  onChange: (change: Partial<WizardLine>) => void;
}

/**
 * Under a line of loose salt in a drink: a pinch is too little to weigh, so
 * offer saline, measured in drops (Q19). Saline is also the finish step's chip.
 */
export function SalineHint({ line, ingredients, onChange }: Props) {
  const ds = useDs();
  if (!isLooseSalt(line.name)) return null;
  return (
    <View role="note" style={[styles.card, { backgroundColor: ds.c.raised }]}>
      <Caption style={styles.flex}>Salt is hard to measure for one drink. Saline goes in by the drop.</Caption>
      <Button
        label="Use saline"
        variant="ghost"
        size="sm"
        accessibilityLabel={`Use 2 drops of saline instead of ${line.name}`}
        onPress={() => onChange({ ...saline(ingredients), unit: 'drop', amount: '2', prep: undefined, technique: undefined, bottle: undefined, named: undefined, later: undefined })}
      />
    </View>
  );
}

// The catalog's saline, under whichever name it has; a new name otherwise.
function saline(ingredients: readonly CatalogIngredient[]) {
  const named = ['Saline solution', 'Saline'].map((n) => pickByName(n, ingredients)).find((p) => p.id);
  return named ?? pickByName('Saline solution', ingredients);
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.control, paddingLeft: space.md, paddingRight: space.xs, marginTop: space.sm },
  flex: { flex: 1 },
});
