import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, DateField, Field } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { RowDivider, SwitchRow } from '@/components/screens/settings/SettingsParts';
import { STATUS } from '@/constants/palette';
import { space } from '@/constants/tokens';
import type { RoleMatrixRow, VenueRoleDraft } from '@/hooks/useVenueRoles';
import { baseCapabilities, CAPABILITY_GROUPS, dayOfEnd, endOfDay, overridesFor } from '@/lib/roleMatrix';
import { ROLE_LEVELS, roleLabel } from '@/lib/roles';

const ADMIN = 40;
const OVERRIDABLE_ROWS = CAPABILITY_GROUPS.flatMap((g) => g.rows).filter((r) => !r.levelBound);

/**
 * New role or Edit role: a name, the base level it starts from, the
 * capabilities it adds or takes away, and for guest staff the last day they
 * have access. Level-bound capabilities follow the base level, so they aren't
 * offered here. The parent saves; errors come back as `error`.
 */
export function RoleSheet({ role, matrix, visible, busy, error, onClose, onSave, onDelete }: {
  /** The role to edit, or null for a new one. */
  role: RoleMatrixRow | null;
  matrix: RoleMatrixRow[];
  visible: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (draft: VenueRoleDraft) => void;
  onDelete: (role: RoleMatrixRow) => void;
}) {
  const [name, setName] = useState(role?.name ?? '');
  const [level, setLevel] = useState(role?.base_level ?? 20);
  const [on, setOn] = useState<string[]>(role?.capabilities ?? baseCapabilities(matrix, 20));
  const [lastDay, setLastDay] = useState(dayOfEnd(role?.ends_at));
  const baseCaps = baseCapabilities(matrix, level);
  const missingName = !name.trim();

  const pickLevel = (next: number) => {
    // Keep the role's changes from its old base level on top of the new one.
    const { granted, revoked } = overridesFor(baseCapabilities(matrix, level), on);
    setOn([...baseCapabilities(matrix, next).filter((c) => !revoked.includes(c)), ...granted]);
    setLevel(next);
    if (next >= ADMIN) setLastDay('');
  };

  const save = () => {
    if (missingName) return;
    onSave({
      id: role?.role_id ?? undefined,
      name,
      base_level: level,
      ...overridesFor(baseCaps, on),
      ends_at: lastDay ? endOfDay(lastDay) : null,
    });
  };

  return (
    <MenuSheet
      visible={visible}
      onClose={onClose}
      title={role ? `Edit ${role.name ?? 'role'}` : 'New role'}
      footer={
        <View style={styles.footer}>
          {error ? <Caption color={STATUS.danger} role="alert">{error}</Caption> : null}
          <Button label={role ? 'Save role' : 'Add role'} disabled={busy || missingName} onPress={save} />
          {role ? <Button label="Delete role" variant="danger" disabled={busy} onPress={() => onDelete(role)} /> : null}
        </View>
      }
    >
      <Field label="Name" value={name} onChangeText={setName} placeholder="Barback, Head bartender, Guest bartender" maxLength={40} />
      <View role="radiogroup" accessibilityLabel="Starts from" style={styles.list}>
        <Caption tone="muted" role="heading">STARTS FROM</Caption>
        {ROLE_LEVELS.map((r) => (
          <Choice key={r.level} label={roleLabel(r.level)} selected={level === r.level} disabled={busy} onPress={() => pickLevel(r.level)} />
        ))}
      </View>
      <View style={styles.list}>
        <Caption tone="muted" role="heading">WHAT IT CAN DO</Caption>
        {OVERRIDABLE_ROWS.map((r, i) => {
          const value = on.includes(r.id);
          const changed = value !== baseCaps.includes(r.id);
          return (
            <View key={r.id}>
              {i > 0 ? <RowDivider /> : null}
              <SwitchRow
                label={r.label}
                detail={changed ? `Changed from ${roleLabel(level)}` : r.detail}
                value={value}
                disabled={busy}
                onValueChange={(next) => setOn((list) => (next ? [...list, r.id] : list.filter((c) => c !== r.id)))}
              />
            </View>
          );
        })}
        <Caption tone="muted">Seeing the menu and specs, editing drinks, menus, staff and brand follow the base level.</Caption>
      </View>
      {level < ADMIN ? (
        <DateField
          label="Last day (guest staff)"
          value={lastDay}
          onChange={setLastDay}
          clearable
          placeholder="No end date"
          hint="They lose access on their own at midnight after this day."
        />
      ) : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  footer: { gap: space.sm },
});
