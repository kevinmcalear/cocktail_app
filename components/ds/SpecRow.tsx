import { StyleSheet, View } from 'react-native';

import { space, type } from '@/constants/tokens';

import { PressableScale } from './PressableScale';

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
  /** Service mode reads bigger (1.25). */
  scale?: number;
  onPress?: () => void;
}

/**
 * One line of a spec, readable across the bar: the amount in its own aligned
 * column in the accent, then the ingredient.
 */
export function SpecRow({ amount, ingredient, houseMade, optional, note, scale = 1, onPress }: SpecRowProps) {
  const ds = useDs();
  const spoken = [amount, ingredient, houseMade && 'house-made', optional && 'optional', note].filter(Boolean).join(', ');
  const big = (t: (typeof type)['spec']) => (scale === 1 ? undefined : { fontSize: t.fontSize * scale, lineHeight: t.lineHeight * scale });
  const Row = onPress ? PressableScale : View;
  return (
    <Row
      accessible
      accessibilityLabel={spoken}
      role={onPress ? 'button' : undefined}
      onPress={onPress}
      haptic={onPress ? false : undefined}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      <Spec tone="accent" style={[styles.amount, { width: 96 * scale }, big(type.spec)]}>
        {amount}
      </Spec>
      <View style={styles.name}>
        <Body style={big(type.body)}>{ingredient}</Body>
        {note ? <Caption tone="muted">{note}</Caption> : null}
        {houseMade || optional ? (
          <View style={styles.tags}>
            {houseMade ? <Tag label="House-made" tone="accent" /> : null}
            {optional ? <Tag label="Optional" /> : null}
          </View>
        ) : null}
      </View>
    </Row>
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
