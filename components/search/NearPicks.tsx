import { Children, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { layout, radius, space } from '@/constants/tokens';

/** A picker's rows: what matched as typed, then its close names (hooks/useSearchNear withNear). */
export function splitNear<T extends { near?: boolean }>(rows: readonly T[]): [plain: T[], near: T[]] {
  return [rows.filter((r) => !r.near), rows.filter((r) => r.near)];
}

interface NearPicksProps<T> {
  /** Something matched as typed: the close names come last, "Spelled differently". Nothing did: they lead, "Did you mean". */
  found: boolean;
  near: readonly T[];
  /** One close name, as the picker draws its rows. Tapping it is "yes". */
  render: (row: T) => ReactNode;
  /** "No, it’s something else": over the picker's own add rows when it asked. */
  no?: string;
  /** The picker's own add rows, if it has any. */
  children?: ReactNode;
  labelStyle?: StyleProp<TextStyle>;
  /** Chips: the close names share one row in this style. */
  rowStyle?: StyleProp<ViewStyle>;
}

/**
 * "Did you mean" inside a picker (whole-app canvas, Search page, "Did you
 * mean, everywhere": 2A, 2B). Nothing found as typed: the close names lead,
 * and the picker's add rows sit under "No, it’s something else". Something
 * found: the close names come after it, other spellings last.
 */
export function NearPicks<T>({ found, near, render, no = 'No, it’s something else', children, labelStyle, rowStyle }: NearPicksProps<T>) {
  if (!near.length) return <>{children}</>;
  return (
    <>
      <NearLabel found={found} style={labelStyle} />
      {rowStyle ? <View style={rowStyle}>{near.map(render)}</View> : near.map(render)}
      {Children.toArray(children).length && !found ? (
        <Caption tone="muted" style={[styles.label, labelStyle]}>
          {no}
        </Caption>
      ) : null}
      {children}
    </>
  );
}

/** The heading over a picker's close names: "Did you mean", or "Spelled differently" after what matched. */
export function NearLabel({ found, style }: { found: boolean; style?: StyleProp<TextStyle> }) {
  return (
    <Caption tone="muted" role="heading" style={[styles.label, style]}>
      {found ? 'Spelled differently' : 'Did you mean'}
    </Caption>
  );
}

type PickRow = {
  id: string;
  label: string;
  /** A muted line under the name: a person's "@jo.park · Little Rye". */
  sub?: string;
  near?: boolean;
};

interface PickListProps {
  rows: readonly PickRow[];
  /** Nothing matched and nothing is close: "No bar by that name has a page yet." */
  empty: string;
  /** Over `add` when it asked "Did you mean": "No, it’s somewhere else". */
  no?: string;
  onPick: (id: string) => void;
  /** The picker's own add row: "Add “Lanturn Room” as a new bar". */
  add?: { label: string; sub: string; onPress: () => void };
}

/** A picker's list of names: what matched, then the close ones (NearPicks), then its add row. */
export function PickList({ rows, empty, no, onPick, add }: PickListProps) {
  const ds = useDs();
  const [plain, near] = splitNear(rows);
  const row = (r: PickRow) => (
    <PressableScale key={r.id} role="button" accessibilityLabel={r.sub ? `${r.label}, ${r.sub}` : r.label} onPress={() => onPick(r.id)} style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <Body numberOfLines={1}>{r.label}</Body>
      {r.sub ? (
        <Caption tone="muted" numberOfLines={1}>
          {r.sub}
        </Caption>
      ) : null}
    </PressableScale>
  );
  if (!rows.length && !add) return <Caption tone="muted">{empty}</Caption>;
  return (
    <View role="list" style={[styles.list, { borderColor: ds.c.line }]}>
      {plain.map(row)}
      {!rows.length ? (
        <Caption tone="muted" style={styles.inset}>
          {empty}
        </Caption>
      ) : null}
      <NearPicks found={plain.length > 0} near={near} render={row} no={no} labelStyle={styles.inset}>
        {add ? (
          <PressableScale role="button" accessibilityLabel={add.label} accessibilityHint={add.sub} onPress={add.onPress} style={[styles.row, { borderBottomColor: ds.c.line }]}>
            <Body numberOfLines={1}>{add.label}</Body>
            <Caption tone="muted">{add.sub}</Caption>
          </PressableScale>
        ) : null}
      </NearPicks>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { paddingTop: space.xs },
  inset: { paddingHorizontal: space.md, paddingTop: space.sm },
  list: { borderRadius: radius.control, borderWidth: 1, overflow: 'hidden' },
  row: { minHeight: layout.minTapTarget + 4, justifyContent: 'center', paddingHorizontal: space.md, paddingVertical: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
});
