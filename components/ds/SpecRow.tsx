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
  /** A second reading of the amount: "52.6 ml · 21.1 ml ethanol". */
  detail?: string;
  /** Service mode reads bigger (1.25). */
  scale?: number;
  onPress?: () => void;
  /** Tapping the amount alone: the conversions sheet. */
  onPressAmount?: () => void;
  /**
   * Hold the amount column open when this line is blank, so its name lines up
   * with lines that are measured. Leave it off when the drink has no measurements.
   */
  alignAmount?: boolean;
}

/**
 * One line of a spec, readable across the bar: the amount in its own aligned
 * column in the accent, then the ingredient.
 *
 * When the amount has its own action, the line splits into two sibling
 * controls (amount, then ingredient) so no button sits inside another.
 */
export function SpecRow({ amount, ingredient, houseMade, optional, note, detail, scale = 1, onPress, onPressAmount, alignAmount }: SpecRowProps) {
  const ds = useDs();
  const big = (t: (typeof type)['spec']) => (scale === 1 ? undefined : { fontSize: t.fontSize * scale, lineHeight: t.lineHeight * scale });
  const showAmount = amount.length > 0 || !!alignAmount;
  const split = !!onPressAmount && amount.length > 0;
  const rest = [ingredient, detail, houseMade && 'house-made', optional && 'optional', note].filter(Boolean).join(', ');
  const amountWidth = { width: 96 * scale };

  const name = (
    <>
      <Body style={big(type.body)}>{ingredient}</Body>
      {detail ? <Caption tone="muted">{detail}</Caption> : null}
      {note ? <Caption tone="muted">{note}</Caption> : null}
      {houseMade || optional ? (
        <View style={styles.tags}>
          {houseMade ? <Tag label="House-made" tone="accent" /> : null}
          {optional ? <Tag label="Optional" /> : null}
        </View>
      ) : null}
    </>
  );

  if (split) {
    const Name = onPress ? PressableScale : View;
    return (
      <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
        <PressableScale role="button" aria-label={`${amount}, read in other units`} haptic={false} onPress={onPressAmount} style={[styles.cell, amountWidth]}>
          <Spec tone="accent" style={big(type.spec)}>
            {amount}
          </Spec>
        </PressableScale>
        <Name accessible aria-label={rest} role={onPress ? 'button' : undefined} onPress={onPress} haptic={onPress ? false : undefined} style={[styles.cell, styles.name]}>
          {name}
        </Name>
      </View>
    );
  }

  const Row = onPress ? PressableScale : View;
  return (
    <Row
      accessible
      aria-label={amount ? `${amount}, ${rest}` : rest}
      role={onPress ? 'button' : undefined}
      onPress={onPress}
      haptic={onPress ? false : undefined}
      style={[styles.row, styles.cell, { borderBottomColor: ds.c.line }]}
    >
      {showAmount ? (
        <Spec tone="accent" style={[amountWidth, big(type.spec)]}>
          {amount}
        </Spec>
      ) : null}
      <View style={styles.name}>{name}</View>
    </Row>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // In a split line each control carries the padding, so the whole line stays tappable.
  cell: { paddingVertical: space.md },
  name: { flex: 1, gap: space.xs },
  tags: { flexDirection: 'row', gap: space.xs, marginTop: space.xs },
});
