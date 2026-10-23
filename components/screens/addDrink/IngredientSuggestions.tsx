import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/tokens';
import { COMMON_INGREDIENTS, pickByName, type StepProps, type WizardLine, type WizardPick } from '@/lib/drinkWizard';

import { CloseToClassic, GoesWith } from './GoesWith';
import type { CatalogIngredient } from './IngredientSearch';
import { StartFromClassic } from './StartFromClassic';
import { WizardChip } from './WizardChrome';

/** How many quick adds show under the field. */
const QUICK = 8;

interface IngredientSuggestionsProps extends StepProps {
  /** One drink's own lines, not the batch: what the suggestions read. */
  poured: readonly WizardLine[];
  ingredients: readonly CatalogIngredient[];
  onAdd: (pick: WizardPick) => void;
}

/**
 * Under the ingredient field, for a drink: what goes with what's in it (the
 * common ones as quick adds until something does), the classic it's close
 * to, and, with nothing in it yet, a classic to start from.
 */
export function IngredientSuggestions({ draft, set, poured, ingredients, onAdd }: IngredientSuggestionsProps) {
  const has = (name: string) => poured.some((l) => l.name.trim().toLowerCase() === name.toLowerCase());
  const quick = COMMON_INGREDIENTS.filter((n) => !has(n)).slice(0, QUICK);
  // Its generic's id (Mezcal's is Agave Spirit), for matching classics.
  const genericOf = (id: string) => ingredients.find((i) => i.id === id)?.generic_id ?? null;
  return (
    <>
      <GoesWith
        lines={poured}
        onAdd={onAdd}
        fallback={
          <View role="group" accessibilityLabel="Quick adds" style={styles.chips}>
            {quick.map((n) => (
              <WizardChip key={n} label={n} add kind="button" onPress={() => onAdd(pickByName(n, ingredients))} />
            ))}
          </View>
        }
        after={<CloseToClassic ingredients={poured.flatMap((l) => (l.id ? [{ id: l.id, generic: genericOf(l.id) }] : []))} riffOf={draft.riffOf} onRiff={(riffOf) => set({ riffOf })} />}
      />
      {draft.lines.length ? null : <StartFromClassic set={set} />}
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
