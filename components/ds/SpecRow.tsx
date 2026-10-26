import { StyleSheet, View } from 'react-native';

import { space, type } from '@/constants/tokens';

import { IngredientThumb } from './IngredientThumb';
import { PressableScale } from './PressableScale';

import { Tag } from './Tag';
import { Body, Caption, Spec } from './Text';
import { useDs } from './theme';

export interface SpecRowProps {
  /** Already formatted for the person's units, e.g. "22.5 ml" or "1 dash". */
  amount: string;
  ingredient: string;
  /**
   * The ingredient whose drawing sits beside its name. Null draws from the name
   * alone (not in the catalog); leave it out for a line with no picture at all.
   */
  ingredientId?: string | null;
  /** Made in house from its own recipe (a syrup, a wash, a batch). */
  houseMade?: boolean;
  optional?: boolean;
  note?: string;
  /** A word about this line for this person, as a tag: "Not on your shelf". */
  flag?: string;
  /** On the shopping list (shopping In 2): an accent "On your list" tag with a tick, in place of the flag. */
  listed?: boolean;
  /** A small line under the name, e.g. the ingredient's "40% ABV". */
  detail?: string;
  /** Service mode reads bigger (1.25). */
  scale?: number;
  /** Less padding above and below (the drink page, where the whole spec fits on the first screen). */
  dense?: boolean;
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
 * column in the accent, then the ingredient, then its drawing at the right edge.
 *
 * When the amount has its own action, the line splits into two sibling
 * controls (amount, then ingredient) so no button sits inside another.
 */
export function SpecRow({ amount, ingredient, ingredientId, houseMade, optional, note, flag: flagged, listed, detail, scale = 1, dense, onPress, onPressAmount, alignAmount }: SpecRowProps) {
  const ds = useDs();
  const flag = listed ? 'On your list' : flagged;
  const big = (t: (typeof type)['spec']) => (scale === 1 ? undefined : { fontSize: t.fontSize * scale, lineHeight: t.lineHeight * scale });
  const showAmount = amount.length > 0 || !!alignAmount;
  const split = !!onPressAmount && amount.length > 0;
  const rest = [ingredient, detail, houseMade && 'house-made', optional && 'optional', note, flag].filter(Boolean).join(', ');
  const amountWidth = { width: 96 * scale };
  const cell = dense ? styles.dense : styles.cell;

  const text = (
    <>
      <Body style={big(type.body)}>{ingredient}</Body>
      {detail ? <Caption tone="muted">{detail}</Caption> : null}
      {note ? <Caption tone="muted">{note}</Caption> : null}
      {houseMade || optional || flag ? (
        <View style={styles.tags}>
          {houseMade ? <Tag label="House-made" tone="accent" /> : null}
          {optional ? <Tag label="Optional" /> : null}
          {flag ? <Tag label={flag} tone={listed ? 'accent' : undefined} icon={listed ? 'checkmark' : undefined} /> : null}
        </View>
      ) : null}
    </>
  );
  const pictured = ingredientId !== undefined;
  // The drawing ends the line, against the margin, so amounts and names line up on the left (Eddie E42).
  const name = pictured ? (
    <>
      <View style={styles.text}>{text}</View>
      <IngredientThumb id={ingredientId} name={ingredient} size={36 * scale} />
    </>
  ) : (
    text
  );

  if (split) {
    const Name = onPress ? PressableScale : View;
    return (
      <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
        <PressableScale role="button" aria-label={`${amount}, read in other units`} haptic={false} onPress={onPressAmount} style={[cell, amountWidth]}>
          <Spec tone="accent" style={big(type.spec)}>
            {amount}
          </Spec>
        </PressableScale>
        <Name accessible aria-label={rest} role={onPress ? 'button' : undefined} onPress={onPress} haptic={onPress ? false : undefined} style={[cell, styles.name, pictured && styles.pictured]}>
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
      style={[styles.row, cell, { borderBottomColor: ds.c.line }]}
    >
      {showAmount ? (
        <Spec tone="accent" style={[amountWidth, big(type.spec)]}>
          {amount}
        </Spec>
      ) : null}
      <View style={[styles.name, pictured && styles.pictured]}>{name}</View>
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
  dense: { paddingVertical: space.sm },
  name: { flex: 1, gap: space.xs },
  pictured: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  text: { flex: 1, gap: space.xs },
  tags: { flexDirection: 'row', gap: space.xs, marginTop: space.xs },
});
