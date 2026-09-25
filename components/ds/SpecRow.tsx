import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/tokens';

import { Tag } from './Tag';
import { Body, Caption, Spec } from './Text';
import { useDs } from './theme';

export interface SpecRowProps {
  /** Already formatted for the person's units, e.g. "22.5 ml" or "1 dash". */
  amount: string;
  ingredient: string;
  /** Made in house from its own recipe (a syrup, a wash, a batch). */
  houseMade?: boolean;
  optional?: boolean;
  note?: string;
}

/**
 * One line of a spec, readable across the bar: the amount in its own aligned
 * column in the accent, then the ingredient.
 */
export function SpecRow({ amount, ingredient, houseMade, optional, note }: SpecRowProps) {
  const ds = useDs();
  const spoken = [amount, ingredient, houseMade && 'house-made', optional && 'optional', note].filter(Boolean).join(', ');
  return (
    <View accessible accessibilityLabel={spoken} style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <Spec tone="accent" style={styles.amount}>
        {amount}
      </Spec>
      <View style={styles.name}>
        <Body>{ingredient}</Body>
        {note ? <Caption tone="muted">{note}</Caption> : null}
        {houseMade || optional ? (
          <View style={styles.tags}>
            {houseMade ? <Tag label="House-made" tone="accent" /> : null}
            {optional ? <Tag label="Optional" /> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  amount: { width: 96 },
  name: { flex: 1, gap: space.xs },
  tags: { flexDirection: 'row', gap: space.xs, marginTop: space.xs },
});
