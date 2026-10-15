import { Fragment } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, Surface, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import type { RoleMatrixRow } from '@/hooks/useVenueRoles';
import { withAlpha } from '@/lib/color';
import { CAPABILITY_GROUPS, cell, endsLabel, type Cell } from '@/lib/roleMatrix';
import { roleLabel } from '@/lib/roles';

const LABEL_WIDTH = 240;
const COLUMN = 92;
const MARK = 14;
const CHANGED_DOT = 7;

function columnName(c: RoleMatrixRow): string {
  return c.role_id ? (c.name ?? '') : roleLabel(c.base_level);
}

/** Can, can't, or changed from the base level: a dot, a ring, and a raised box with a corner dot. */
function Mark({ value, label }: { value: Cell; label: string }) {
  const ds = useDs();
  return (
    <View
      role="img"
      accessibilityLabel={label}
      style={[styles.cell, value.changed ? { backgroundColor: ds.c.raised, borderColor: ds.c.lineStrong, borderWidth: 1 } : null]}
    >
      <View style={[styles.mark, value.can ? { backgroundColor: ds.c.ink } : { borderWidth: 1.5, borderColor: ds.c.faint }]} />
      {value.changed ? <View style={[styles.changedDot, { backgroundColor: ds.c.ink }]} /> : null}
    </View>
  );
}

/** A row of the table: a capability on Roles and access, a drink section on Who sees what. */
export interface MatrixRowSpec {
  id: string;
  label: string;
  detail?: string;
  levelBound?: boolean;
}

/** The words under the table, which differ between Roles and access and Who sees what. */
export interface MatrixLegend {
  yes: string;
  no: string;
  lock: string;
}

const ROLES_LEGEND: MatrixLegend = { yes: 'Can', no: 'Can’t', lock: 'Set by the base level. Menu and Specs also follow Who sees what in venue settings.' };

/**
 * What each role can do: base levels and the venue's own roles as columns,
 * capabilities as rows in three groups. Scrolls sideways when it doesn't fit.
 * Admins get an Edit button on each of the venue's roles. Who sees what on a
 * drink (drink-role-lens) passes its own rows, cells and words, and marks the
 * viewer's column You.
 */
export function RoleMatrixTable({ matrix, barName, onEdit, groups = CAPABILITY_GROUPS, cellOf, label, heading = 'What they can do', legend = ROLES_LEGEND, isYou }: {
  matrix: RoleMatrixRow[];
  barName: string;
  onEdit?: (role: RoleMatrixRow) => void;
  groups?: { title: string; rows: MatrixRowSpec[] }[];
  cellOf?: (column: RoleMatrixRow, row: MatrixRowSpec) => Cell;
  label?: string;
  heading?: string;
  legend?: MatrixLegend;
  isYou?: (column: RoleMatrixRow) => boolean;
}) {
  const ds = useDs();
  const value = cellOf ?? ((c: RoleMatrixRow, r: MatrixRowSpec) => cell(matrix, c, r.id));
  return (
    <View style={styles.wrap}>
      <Surface style={styles.card}>
        {/* The table fills the card; it scrolls sideways only when the card is too narrow. */}
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.scroll}>
          <View role="table" accessibilityLabel={label ?? `What each ${barName} role can do`} style={styles.table}>
            <View role="row" style={[styles.row, { borderBottomColor: ds.c.lineStrong }]}>
              <View role="columnheader" style={styles.label}>
                <Caption tone="muted">{heading}</Caption>
              </View>
              {matrix.map((c) => {
                const name = columnName(c);
                const sub = c.role_id ? (endsLabel(c.ends_at) ? `Ends ${endsLabel(c.ends_at)}` : `From ${roleLabel(c.base_level)}`) : `Base · ${c.base_level}`;
                const head = (
                  <>
                    <Body style={[styles.center, styles.head]} numberOfLines={2}>{name}</Body>
                    <Caption tone="muted" style={styles.center}>{sub}</Caption>
                    {isYou?.(c) ? (
                      <View style={[styles.you, { backgroundColor: withAlpha(ds.accentText, 0.2) }]}>
                        <Caption color={ds.accentText} style={styles.head}>You</Caption>
                      </View>
                    ) : null}
                  </>
                );
                return (
                  <View key={c.role_id ?? c.base_level} role="columnheader" style={styles.column}>
                    {c.role_id && onEdit ? (
                      <PressableScale role="button" accessibilityLabel={`Edit ${name}`} onPress={() => onEdit(c)} style={[styles.edit, { borderColor: ds.c.line }]}>
                        {head}
                        <IconSymbol name="pencil" size={14} color={ds.c.muted} />
                      </PressableScale>
                    ) : (
                      head
                    )}
                  </View>
                );
              })}
            </View>
            {groups.map((g) => (
              <Fragment key={g.title}>
                <View role="row" style={styles.groupRow}>
                  <Caption tone="muted" role="rowheader" style={styles.groupTitle}>{g.title.toUpperCase()}</Caption>
                </View>
                {g.rows.map((r) => (
                  <View key={r.id} role="row" style={[styles.row, { borderBottomColor: ds.c.line }]}>
                    <View role="rowheader" style={[styles.label, styles.labelRow]}>
                      <View style={styles.labelText}>
                        <Body numberOfLines={1}>{r.label}</Body>
                        {r.detail ? <Caption tone="muted">{r.detail}</Caption> : null}
                      </View>
                      {r.levelBound ? (
                        <View role="img" accessibilityLabel="Set by the base level">
                          <IconSymbol name="lock.fill" size={14} color={ds.c.muted} />
                        </View>
                      ) : null}
                    </View>
                    {matrix.map((c) => {
                      const v = value(c, r);
                      const words = `${v.can ? legend.yes : legend.no}${v.changed ? ', changed from its base level' : ''}`;
                      return (
                        <View key={c.role_id ?? c.base_level} role="cell" style={styles.column}>
                          <Mark value={v} label={`${columnName(c)}: ${r.label}: ${words}`} />
                        </View>
                      );
                    })}
                  </View>
                ))}
              </Fragment>
            ))}
          </View>
        </ScrollView>
      </Surface>
      <View style={styles.legend}>
        <View style={styles.key}>
          <View style={[styles.keyMark, { backgroundColor: ds.c.ink }]} />
          <Caption tone="muted">{legend.yes}</Caption>
        </View>
        <View style={styles.key}>
          <View style={[styles.keyMark, { borderWidth: 1.5, borderColor: ds.c.faint }]} />
          <Caption tone="muted">{legend.no}</Caption>
        </View>
        <View style={styles.key}>
          <View style={[styles.keyChanged, { backgroundColor: ds.c.raised, borderColor: ds.c.lineStrong }]}>
            <View style={[styles.keyDot, { backgroundColor: ds.c.ink }]} />
          </View>
          <Caption tone="muted">Changed from its base level</Caption>
        </View>
        <View style={styles.key}>
          <IconSymbol name="lock.fill" size={14} color={ds.c.muted} />
          <Caption tone="muted">{legend.lock}</Caption>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  card: { paddingVertical: space.xs, paddingHorizontal: 0 },
  scroll: { flexGrow: 1, paddingHorizontal: space.lg },
  table: { flexGrow: 1 },
  head: { fontFamily: fontFamilies.bodySemiBold },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  groupRow: { paddingTop: space.lg, paddingBottom: space.xs },
  groupTitle: { letterSpacing: 0.8 },
  label: { width: LABEL_WIDTH, paddingVertical: space.sm, paddingRight: space.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  labelText: { flexShrink: 1, gap: 2 },
  column: { flexGrow: 1, flexBasis: COLUMN, minWidth: COLUMN, alignItems: 'center', justifyContent: 'center', paddingVertical: space.xs, paddingHorizontal: space.xs },
  center: { textAlign: 'center' },
  you: { marginTop: 2, paddingHorizontal: space.sm, borderRadius: radius.pill },
  edit: { alignItems: 'center', gap: 2, paddingVertical: space.xs, paddingHorizontal: space.sm, borderRadius: radius.control, borderWidth: 1 },
  cell: { width: 40, height: 36, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  mark: { width: MARK, height: MARK, borderRadius: radius.pill },
  changedDot: { position: 'absolute', top: 5, right: 5, width: CHANGED_DOT, height: CHANGED_DOT, borderRadius: radius.pill },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.lg, rowGap: space.sm },
  key: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  keyMark: { width: 12, height: 12, borderRadius: radius.pill },
  keyChanged: { width: 22, height: 18, borderRadius: radius.mark, borderWidth: 1 },
  keyDot: { position: 'absolute', top: 3, right: 3, width: 5, height: 5, borderRadius: radius.pill },
});
