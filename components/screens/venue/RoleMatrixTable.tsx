import { Fragment } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, Surface, useBreakpoint, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import type { RoleMatrixRow } from '@/hooks/useVenueRoles';
import { pressedProps } from '@/lib/a11yState';
import { withAlpha } from '@/lib/color';
import { CAPABILITY_GROUPS, cell, columnCaption, isChangedBuiltIn, isLocked, type Cell } from '@/lib/roleMatrix';
import { roleLabel } from '@/lib/roles';

const LABEL_WIDTH = 200;
/** Phones keep room for two or three role columns beside the names (drink-role-lens-phone). */
const LABEL_WIDTH_PHONE = 150;
const COLUMN = 92;
const COLUMN_MAX = 136;
const MARK = 14;
const CHANGED_DOT = 6;

function columnName(c: RoleMatrixRow): string {
  return c.role_id ? (c.name ?? '') : roleLabel(c.base_level);
}

/** Can, can't, and changed from where it started: a dot, a ring, and a raised box with a gold corner dot. Always on: a small lock. */
function Mark({ value, label, locked, onPress, disabled }: { value: Cell; label: string; locked?: boolean; onPress?: () => void; disabled?: boolean }) {
  const ds = useDs();
  const inner = (
    <>
      <View style={[styles.mark, value.can ? { backgroundColor: ds.c.ink } : { borderWidth: 1.5, borderColor: ds.c.faint }]} />
      {value.changed ? <View style={[styles.changedDot, { backgroundColor: ds.accentText }]} /> : null}
      {locked ? (
        <View style={styles.lock}>
          <IconSymbol name="lock.fill" size={11} color={ds.c.muted} />
        </View>
      ) : null}
    </>
  );
  const box = [styles.cell, value.changed ? { backgroundColor: ds.c.raised, borderColor: ds.c.lineStrong, borderWidth: 1 } : null];
  if (!onPress || locked) {
    return <View role="img" accessibilityLabel={label} style={box}>{inner}</View>;
  }
  return (
    <PressableScale role="button" accessibilityLabel={label} {...pressedProps(value.can)} disabled={disabled} onPress={onPress} style={box}>
      {inner}
    </PressableScale>
  );
}

/** A row of the table: a capability on Roles and access, a drink section on Who sees what. */
export interface MatrixRowSpec {
  id: string;
  label: string;
  detail?: string;
  /** Follows the built-in role, whatever a venue changes (Who sees what's sections with no permission). */
  levelBound?: boolean;
}

/** The words under the table, which differ between Roles and access and Who sees what. */
export interface MatrixLegend {
  yes: string;
  no: string;
  lock: string;
}

const ROLES_LEGEND: MatrixLegend = { yes: 'Can', no: 'Can’t', lock: 'An Admin always keeps this' };

/**
 * What each role can do: built-in roles and the venue's own as columns,
 * permissions as rows in three groups. Scrolls sideways when it doesn't fit.
 * With onToggle every dot is a button that switches it for that role (an
 * Admin's staff stays, with a lock); with onEdit the venue's roles have an
 * Edit button, and with onReset a changed built-in role offers Reset to
 * built in. Who sees what on a drink (drink-role-lens) passes its own rows,
 * cells and words, and marks the viewer's column You.
 */
export function RoleMatrixTable({ matrix, barName, onEdit, onToggle, onReset, canChange = () => true, busy, groups = CAPABILITY_GROUPS, cellOf, label, heading = 'What they can do', legend = ROLES_LEGEND, isYou }: {
  matrix: RoleMatrixRow[];
  barName: string;
  onEdit?: (role: RoleMatrixRow) => void;
  onToggle?: (role: RoleMatrixRow, capability: string, on: boolean) => void;
  onReset?: (role: RoleMatrixRow) => void;
  /** Whether this viewer may change a column at all (only an Admin changes Admin roles); the others show as they are. */
  canChange?: (role: RoleMatrixRow) => boolean;
  busy?: boolean;
  groups?: { title: string; rows: MatrixRowSpec[] }[];
  cellOf?: (column: RoleMatrixRow, row: MatrixRowSpec) => Cell;
  label?: string;
  heading?: string;
  legend?: MatrixLegend;
  isYou?: (column: RoleMatrixRow) => boolean;
}) {
  const ds = useDs();
  const labelWidth = { width: useBreakpoint() === 'phone' ? LABEL_WIDTH_PHONE : LABEL_WIDTH };
  const value = cellOf ?? ((c: RoleMatrixRow, r: MatrixRowSpec) => cell(matrix, c, r.id));
  // The Admin lock is a Roles and access rule; Who sees what has its own rows.
  const lockable = !cellOf;
  return (
    <View style={styles.wrap}>
      <Surface style={styles.card}>
        {/* The table fills the card; it scrolls sideways only when the card is too narrow. */}
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.scroll}>
          <View role="table" accessibilityLabel={label ?? `What each ${barName} role can do`} style={styles.table}>
            <View role="row" style={[styles.row, { borderBottomColor: ds.c.lineStrong }]}>
              <View role="columnheader" style={[styles.label, labelWidth]}>
                <Caption tone="muted">{heading}</Caption>
              </View>
              {matrix.map((c) => {
                const name = columnName(c);
                const mine = canChange(c);
                const head = (
                  <>
                    <Body style={[styles.center, styles.head]} numberOfLines={2}>{name}</Body>
                    <Caption tone="muted" style={styles.center}>{columnCaption(c)}</Caption>
                    {isYou?.(c) ? (
                      <View style={[styles.you, { backgroundColor: withAlpha(ds.accentText, 0.2) }]}>
                        <Caption color={ds.accentText} style={styles.head}>You</Caption>
                      </View>
                    ) : null}
                  </>
                );
                return (
                  <View key={c.role_id ?? c.base_level} role="columnheader" style={styles.column}>
                    {c.role_id && onEdit && mine ? (
                      <PressableScale role="button" accessibilityLabel={`Edit ${name}`} onPress={() => onEdit(c)} style={[styles.edit, { borderColor: ds.c.line }]}>
                        {head}
                        <IconSymbol name="pencil" size={14} color={ds.c.muted} />
                      </PressableScale>
                    ) : (
                      head
                    )}
                    {onReset && mine && isChangedBuiltIn(c) ? (
                      <PressableScale role="button" accessibilityLabel={`Reset ${name} to built in`} disabled={busy} onPress={() => onReset(c)} style={styles.reset}>
                        <Caption color={ds.accentText} style={styles.center}>Reset to built in</Caption>
                      </PressableScale>
                    ) : null}
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
                    <View role="rowheader" style={[styles.label, labelWidth, styles.labelRow]}>
                      <View style={styles.labelText}>
                        <Body numberOfLines={2}>{r.label}</Body>
                        {r.detail ? <Caption tone="muted">{r.detail}</Caption> : null}
                      </View>
                      {r.levelBound ? (
                        <View role="img" accessibilityLabel="Follows the built-in role">
                          <IconSymbol name="lock.fill" size={14} color={ds.c.muted} />
                        </View>
                      ) : null}
                    </View>
                    {matrix.map((c) => {
                      const v = value(c, r);
                      const toggle = onToggle && canChange(c) ? onToggle : undefined;
                      const locked = lockable && isLocked(c, r.id);
                      // Roles and access reads Yes and No, as the board labels them; Who sees what uses its legend's words.
                      const [yes, no] = lockable ? ['Yes', 'No'] : [legend.yes, legend.no];
                      const words = locked
                        ? `${yes}, always`
                        : `${v.can ? yes : no}${v.changed ? ', changed from where it started' : ''}${toggle ? '. Tap to change' : ''}`;
                      return (
                        <View key={c.role_id ?? c.base_level} role="cell" style={styles.column}>
                          <Mark
                            value={v}
                            label={`${columnName(c)}: ${r.label}: ${words}`}
                            locked={locked}
                            disabled={busy}
                            onPress={toggle ? () => toggle(c, r.id, !v.can) : undefined}
                          />
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
          <View style={[styles.keyDot, { backgroundColor: ds.accentText }]} />
          <Caption tone="muted">Changed from where it started</Caption>
        </View>
        <View style={styles.key}>
          <IconSymbol name="lock.fill" size={12} color={ds.c.muted} />
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
  label: { paddingVertical: space.sm, paddingRight: space.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  labelText: { flexShrink: 1, gap: 2 },
  // A wide cap so long role names wrap and eight roles fit beside the names on a desktop (board fix 14).
  column: { flexGrow: 1, flexBasis: COLUMN, minWidth: COLUMN, maxWidth: COLUMN_MAX, alignItems: 'center', justifyContent: 'center', paddingVertical: space.xs, paddingHorizontal: space.xs },
  center: { textAlign: 'center' },
  you: { marginTop: 2, paddingHorizontal: space.sm, borderRadius: radius.pill },
  edit: { alignItems: 'center', gap: 2, paddingVertical: space.xs, paddingHorizontal: space.xs, borderRadius: radius.control, borderWidth: 1 },
  reset: { marginTop: 2, paddingVertical: 2, paddingHorizontal: space.xs },
  cell: { width: 40, height: 36, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  mark: { width: MARK, height: MARK, borderRadius: radius.pill },
  changedDot: { position: 'absolute', top: 5, right: 6, width: CHANGED_DOT, height: CHANGED_DOT, borderRadius: radius.pill },
  lock: { position: 'absolute', top: 2, right: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.lg, rowGap: space.sm },
  key: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  keyMark: { width: 12, height: 12, borderRadius: radius.pill },
  keyDot: { width: 6, height: 6, borderRadius: radius.pill },
});
