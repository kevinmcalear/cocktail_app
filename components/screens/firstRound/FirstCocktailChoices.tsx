import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useDrinkLists } from '@/hooks/useDiscover';
import { FIRST_COCKTAILS } from '@/lib/firstRound';

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Opens the add-drink wizard for a venue's first cocktail: from the catalog's
 * classic named `start`, at Review, or from scratch when `start` is null.
 * `back` (the setup checklist) comes back where it was once saved; otherwise
 * it goes to the Library, as the first round does.
 */
export function useStartFirstCocktail() {
  const router = useRouter();
  const classics = useDrinkLists().data ?? [];
  return (barId: string, start: string | null, back?: boolean) => {
    const from = start ? classics.find((c) => sameName(c.name, start))?.id : undefined;
    router.push({ pathname: '/add-cocktail', params: { barId, round: '1', ...(back ? { back: '1' } : {}), ...(start ? { name: start } : {}), ...(from ? { from } : {}) } });
  };
}

/**
 * Old Fashioned, Margarita, Espresso Martini and From scratch as buttons (Eddie
 * E30 B): under the first round's step 1, and under the owner's First drinks
 * on the setup checklist.
 */
export function FirstCocktailChoices({ onPick }: { onPick: (start: string | null) => void }) {
  return (
    <View role="group" aria-label="Start from" style={styles.choices}>
      {FIRST_COCKTAILS.map((name) => (
        <Button key={name} label={name} variant="secondary" dense onPress={() => onPick(name)} style={styles.choice} />
      ))}
      <Button label="From scratch" variant="secondary" dense onPress={() => onPick(null)} style={styles.choice} />
    </View>
  );
}

const styles = StyleSheet.create({
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  choice: { paddingHorizontal: space.lg },
});
