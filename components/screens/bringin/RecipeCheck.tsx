import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Caption, useDs, useGutter } from '@/components/ds';
import { space } from '@/constants/tokens';
import { openPickLine, startChoices, type RecipeChoices } from '@/lib/bringInDraft';
import type { MatchData } from '@/lib/bringInMatch';
import type { ReadFile } from '@/lib/readAnything';
import type { RecipeReading } from '@/supabase/functions/_shared/anythingRead';
import type { DrinkToMake } from '@/hooks/useBringInSave';

import { CheckFooter, CheckTop } from './CheckParts';
import { RecipeDrink, useDrinkMaker } from './RecipeDrink';

interface RecipeCheckProps {
  recipe: RecipeReading;
  files: ReadFile[];
  /** "From a notebook photo": where it came from. */
  from: string;
  data: MatchData;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (drink: DrinkToMake) => void;
  onEditAll: (drink: DrinkToMake) => void;
}

/**
 * The recipe check for one read drink (canvas make-bringin-recipe). More
 * than one is a big import, checked in ImportReview. An open pick doesn't
 * hold the save: it saves as the plain kind.
 */
export function RecipeCheck({ recipe, files, from, data, saving, error, onCancel, onSave, onEditAll }: RecipeCheckProps) {
  const ds = useDs();
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const { toMake } = useDrinkMaker(data);
  const [choices, setChoices] = useState<RecipeChoices>(() => startChoices(recipe));

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + space.sm, paddingHorizontal: gutter }]} keyboardShouldPersistTaps="handled">
        <CheckTop kind="recipes" onCancel={onCancel} />
        <RecipeDrink recipe={recipe} choices={choices} onChange={(change) => setChoices((c) => ({ ...c, ...change }))} files={files} from={from} data={data} />
        {error ? <Caption tone="accent">{error}</Caption> : null}
      </ScrollView>
      <CheckFooter note={openPickLine(recipe, choices, data)}>
        <View style={styles.row}>
          <Button label="Edit all" size="lg" variant="secondary" onPress={() => onEditAll(toMake(recipe, choices))} style={styles.flex} />
          <Button label={saving ? 'Saving…' : 'Save drink'} size="lg" disabled={saving || !choices.name.trim()} onPress={() => onSave(toMake(recipe, choices))} style={styles.wide} />
        </View>
      </CheckFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: space.lg, paddingBottom: space.xxl },
  row: { flexDirection: 'row', gap: space.sm + 2 },
  flex: { flex: 1 },
  wide: { flex: 2 },
});
