import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/tokens';
import { pickByName, type WizardLine } from '@/lib/drinkWizard';
import { isLooseSalt } from '@/lib/unitGuess';

import type { CatalogIngredient } from './IngredientSearch';
import { Prompt } from './Prompt';

interface Props {
  line: WizardLine;
  ingredients: readonly CatalogIngredient[];
  onChange: (change: Partial<WizardLine>) => void;
  /** Put away for this draft (draft.putAway). */
  away?: readonly string[];
  onAway?: (prompt: string) => void;
}

/**
 * Under a line of loose salt in a drink: a pinch is too little to weigh, so
 * offer saline, measured in drops (Q19). Saline is also the finish step's chip.
 */
export function SalineHint({ line, ingredients, onChange, away, onAway }: Props) {
  const prompt = `saline:${line.key}`;
  if (!isLooseSalt(line.name) || away?.includes(prompt)) return null;
  return (
    <View style={styles.space}>
      <Prompt
        icon="flask"
        title="Salt is hard to measure for one drink."
        body="Saline goes in by the drop."
        onDismiss={onAway ? () => onAway(prompt) : undefined}
        actions={[
          {
            label: 'Use 2 drops of saline',
            accessibilityLabel: `Use 2 drops of saline instead of ${line.name}`,
            onPress: () => onChange({ ...saline(ingredients), unit: 'drop', amount: '2', prep: undefined, technique: undefined, bottle: undefined, named: undefined, later: undefined }),
          },
        ]}
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
  space: { marginTop: space.sm },
});
