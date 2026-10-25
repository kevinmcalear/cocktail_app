import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useShelfCheck } from '@/hooks/useShelfCheck';
import { shelfCaption } from '@/lib/shelfCheck';
import type { PresentationRecipe, SpecLine } from '@/lib/spec';
import type { DatabaseItem } from '@/types/types';

import { AddToShopping } from '../shopping/AddToShopping';

import { SpecSection } from './SpecSection';

interface AtHomeSpecProps {
  item: DatabaseItem;
  lines: SpecLine[];
  recipes: PresentationRecipe[] | undefined;
  method: string | null;
  /** Method, glass, ice and garnish, under the lines. */
  make: ReactNode;
  /** "Swap it for…": log your version with the change (the I made it sheet). */
  onSwap: () => void;
}

/**
 * The spec at home (board drink-phone-home): "At home · You have 4 of 5",
 * the lines you don't have marked, the method, and the bottle on your shelf
 * closest to the one you're missing, and "Add Cynar to shopping" (AddToShopping).
 */
export function AtHomeSpec({ item, lines, recipes, method, make, onSwap }: AtHomeSpecProps) {
  const { check, missingName, closest, buy } = useShelfCheck(item.id, lines);
  return (
    <SpecSection itemId={item.id} barId={item.bar_id} recipes={recipes} heading="At home" caption={check ? shelfCaption(check) : null} missing={check?.missing ?? []} make={make}>
      {method ? <Body>{method}</Body> : null}
      {check?.missing.length ? (
        <View style={styles.swap}>
          <AddToShopping drinkId={item.id} buy={buy} />
          <Button label="Swap it for…" variant="secondary" accessibilityHint="Log your version with what you used instead" onPress={onSwap} style={styles.button} />
          {closest && missingName ? <Caption tone="muted">{`On your shelf, ${closest} is closest to ${missingName}.`}</Caption> : null}
        </View>
      ) : null}
    </SpecSection>
  );
}

const styles = StyleSheet.create({
  swap: { gap: space.sm },
  button: { alignSelf: 'flex-start' },
});
