import { Platform, StyleSheet, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { space, type } from '@/constants/tokens';

import { IngredientThumb } from './IngredientThumb';
import { PressableScale } from './PressableScale';

import { Tag } from './Tag';
import { Body, Caption, Spec } from './Text';
import { useDs } from './theme';

export interface SpecRowProps {
  /** Already formatted for the person's units, e.g. "22.5 ml" or "1 dash"; just the number when `unit` is given. */
  amount: string;
  /** The amount's unit, set smaller and muted after the number (the drink page's spec: 22 and 12). */
  unit?: string;
  ingredient: string;
  /**
   * The ingredient whose drawing sits beside its name. Null draws from the name
   * alone (not in the catalog); leave it out for a line with no picture at all.
   */
  ingredientId?: string | null;
  /** Made in house from its own recipe (a syrup, a wash, a batch). */
  houseMade?: boolean;
  optional?: boolean;
  /** Floated on top ("15 ml", tagged Float). */
  floated?: boolean;
  note?: string;
  /** A word about this line for this person, as a tag: "Not on your shelf". */
  flag?: string;
  /**
   * What the line is, as a muted word (the drink page's spec, boards Draw-bg
   * and Desk-page): after the name on a measured row ("Islay scotch float"),
   * at the right on a names-only row ("Candied ginger    Garnish").
   */
  role?: string | null;
  /** On the shopping list (shopping In 2): an accent "On your list" tag with a tick, in place of the flag. */
  listed?: boolean;
  /** A small line under the name, e.g. the ingredient's "40% ABV". */
  detail?: string;
  /** Service mode reads bigger (1.25). */
  scale?: number;
  /** Less padding above and below (the drink page, where the whole spec fits on the first screen). */
  dense?: boolean;
  onPress?: () => void;
  /** It opens a page of its own (a house-made inside a house-made: "Its own recipe: tap it"): a chevron at the end. Android rows ripple instead, as its lists do. */
  chevron?: boolean;
  /** Tapping the amount alone: the conversions sheet. */
  onPressAmount?: () => void;
  /**
   * Hold the amount column open when this line is blank, so its name lines up
   * with lines that are measured. Leave it off when the drink has no measurements.
   */
  alignAmount?: boolean;
}

/** The amount column's width at scale 1: a step's note lines up with the names after it (SpecCard). */
export const SPEC_AMOUNT_WIDTH = 96;

/**
 * One line of a spec, readable across the bar: the amount in its own aligned
 * column in ink (the board sets it dark), then the ingredient, then its drawing at the right edge.
 *
 * When the amount has its own action, the line splits into two sibling
 * controls (amount, then ingredient) so no button sits inside another.
 */
export function SpecRow({ amount, unit, ingredient, ingredientId, houseMade, optional, floated, note, flag: flagged, listed, role, detail, scale = 1, dense, onPress, onPressAmount, alignAmount, chevron }: SpecRowProps) {
  const ds = useDs();
  const flag = listed ? 'On your list' : flagged;
  const big = (t: Sized) => scaled(t, scale);
  const showAmount = amount.length > 0 || !!alignAmount;
  const said = unit ? `${amount} ${unit}` : amount;
  const split = !!onPressAmount && amount.length > 0;
  const rest = [ingredient, role, detail, houseMade && 'house-made', floated && 'float', optional && 'optional', note, flag].filter(Boolean).join(', ');
  const amountWidth = { width: SPEC_AMOUNT_WIDTH * scale };
  const cell = dense ? styles.dense : styles.cell;

  // A measured row reads its role after the name; a names-only row puts it at the right.
  const roleAfter = role && showAmount;
  const roleRight = role && !showAmount;
  const text = (
    <>
      <View style={roleRight ? styles.nameLine : null}>
        <Body style={[big(type.body), roleRight ? styles.grow : null]}>
          {ingredient}
          {roleAfter ? <Body tone="muted" style={big(type.body)}>{` ${role}`}</Body> : null}
        </Body>
        {roleRight ? (
          <Caption tone="muted" style={[styles.roleRight, big(type.caption)]}>
            {role}
          </Caption>
        ) : null}
      </View>
      {detail ? <Caption tone="muted">{detail}</Caption> : null}
      {note ? <Caption tone="muted">{note}</Caption> : null}
      {houseMade || floated || optional || flag ? (
        <View style={styles.tags}>
          {houseMade ? <Tag label="House-made" tone="accent" /> : null}
          {floated ? <Tag label="Float" /> : null}
          {optional ? <Tag label="Optional" /> : null}
          {flag ? <Tag label={flag} tone={listed ? 'accent' : undefined} icon={listed ? 'checkmark' : undefined} /> : null}
        </View>
      ) : null}
    </>
  );
  const pictured = ingredientId !== undefined;
  const more = chevron && Platform.OS !== 'android' ? <IconSymbol name="chevron.right" size={14} color={ds.c.muted} style={styles.chevron} /> : null;
  // The drawing ends the line, against the margin, so amounts and names line up on the left (Eddie E42).
  const name = pictured ? (
    <>
      <View style={styles.text}>{text}</View>
      <IngredientThumb id={ingredientId} name={ingredient} size={36 * scale} />
      {more}
    </>
  ) : more ? (
    <View style={styles.pictured}>
      <View style={styles.text}>{text}</View>
      {more}
    </View>
  ) : (
    text
  );

  if (split) {
    const Name = onPress ? PressableScale : View;
    return (
      <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
        <PressableScale role="button" aria-label={`${said}, read in other units`} haptic={false} onPress={onPressAmount} style={[cell, amountWidth]}>
          <Amount text={amount} unit={unit} scale={scale} />
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
      aria-label={amount ? `${said}, ${rest}` : rest}
      role={onPress ? 'button' : undefined}
      onPress={onPress}
      haptic={onPress ? false : undefined}
      style={[styles.row, cell, { borderBottomColor: ds.c.line }]}
    >
      {showAmount ? <Amount text={amount} unit={unit} scale={scale} style={amountWidth} /> : null}
      <View style={[styles.name, pictured && styles.pictured]}>{name}</View>
    </Row>
  );
}

type Sized = { fontSize: number; lineHeight: number };
/** A text style scaled for service mode (1.25); nothing at 1. */
const scaled = (t: Sized, scale: number) => (scale === 1 ? undefined : { fontSize: t.fontSize * scale, lineHeight: t.lineHeight * scale });

/** The number in the spec's figures, its unit (when given apart) smaller and muted. */
function Amount({ text, unit, scale, style }: { text: string; unit?: string; scale: number; style?: { width: number } }) {
  return (
    <Spec style={[style, scaled(type.spec, scale)]}>
      {text}
      {unit ? (
        <Caption tone="muted" style={scaled(type.caption, scale)}>
          {` ${unit}`}
        </Caption>
      ) : null}
    </Spec>
  );
}

const styles = StyleSheet.create({
  nameLine: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  grow: { flex: 1 },
  roleRight: { flexShrink: 0 },
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
  chevron: { alignSelf: 'center' },
});
