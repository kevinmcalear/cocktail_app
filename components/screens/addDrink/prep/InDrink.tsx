import { StyleSheet, View } from 'react-native';

import { Body, Caption, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { drinksPerBottle, pourMl } from '@/lib/batchLines';
import { amountLabel } from '@/lib/drinkWizard';
import { prepAmounts, type PrepDraft } from '@/lib/prepKinds';

/** The drink a prep is made for ("" before it has a name) and its pour of it. */
export interface InDrinkPour {
  name: string;
  amount: string;
  unit: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * What the drink pours of a prep, beside Makes about (make-anything-steps-2,
 * step 5): "In Salty Boy 22.5 ml", and, as `caption`, "One bottle makes
 * about 33 Salty Boys, so each gets 2.1 g of red miso" (the first line
 * weighed or counted rather than poured).
 */
export function InDrink({ pour, draft, makes, caption }: { pour: InDrinkPour; draft: PrepDraft; makes: number | null; caption?: boolean }) {
  const ds = useDs();
  if (!caption) {
    return (
      <View style={[styles.fact, { backgroundColor: ds.c.raised }]}>
        <Caption tone="muted">{`In ${pour.name || 'the drink'}`}</Caption>
        <Body>{amountLabel(pour) || 'No amount yet'}</Body>
      </View>
    );
  }
  const ml = pourMl(pour);
  const drinks = makes && ml ? drinksPerBottle(makes, ml) : 0;
  if (!drinks || !ml || !makes) return null;
  const counted = prepAmounts(draft).find(({ line, amount }) => amount !== null && line.unit && line.unit !== 'ml' && !line.removed);
  const each = counted ? `, so each gets ${round1((counted.amount! * ml) / makes)} ${counted.line.unit} of ${counted.line.name.toLowerCase()}` : '';
  const name = pour.name || 'drink';
  const many = drinks === 1 || /s$/i.test(name) ? name : `${name}s`;
  return <Caption tone="muted">{`One bottle makes about ${drinks} ${many}${each}.`}</Caption>;
}

const styles = StyleSheet.create({
  fact: { flex: 1, borderRadius: radius.control, padding: space.md, gap: 2 },
});
