import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, DateField, Field } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { RowDivider, SwitchRow } from '@/components/screens/settings/SettingsParts';
import { STATUS } from '@/constants/palette';
import { space } from '@/constants/tokens';
import type { RoleMatrixRow, VenueRoleDraft } from '@/hooks/useVenueRoles';
import { baseCapabilities, CAPABILITY_GROUPS, dayOfEnd, endOfDay, isLocked, overridesFor, ROLE_PRESETS, today, type RolePreset } from '@/lib/roleMatrix';
import { ROLE_LEVELS, roleLabel } from '@/lib/roles';

const ADMIN = 40;
/** "A built-in role": start from one of the five, with nothing switched. */
const BUILT_IN = 'built-in';

/**
 * New role (board fix 14, phone): a name, a ready-made role to start from
 * (Apprentice, Head bartender, Takeover bartender) or a built-in one, every
 * permission as a switch to change before saving, and for a takeover the day
 * it ends. Edit role: the same without the ready-made roles. An Admin role
 * always keeps staff. The parent saves; errors come back as `error`.
 */
export function RoleSheet({ role, matrix, allowAdmin = true, visible, busy, error, onClose, onSave, onDelete }: {
  /** The role to edit, or null for a new one. */
  role: RoleMatrixRow | null;
  matrix: RoleMatrixRow[];
  /** Off for someone with staff who isn't an Admin: the database refuses Admin roles from them. */
  allowAdmin?: boolean;
  visible: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (draft: VenueRoleDraft) => void;
  onDelete: (role: RoleMatrixRow) => void;
}) {
  const first = ROLE_PRESETS[0];
  const [start, setStart] = useState<string>(role ? BUILT_IN : first.id);
  const [name, setName] = useState(role?.name ?? first.name);
  const [level, setLevel] = useState(role?.base_level ?? first.base_level);
  const [on, setOn] = useState<string[]>(role?.capabilities ?? first.on(baseCapabilities(matrix, first.base_level)));
  const [lastDay, setLastDay] = useState(dayOfEnd(role?.ends_at));
  const baseCaps = baseCapabilities(matrix, level);
  const missingName = !name.trim();
  const presetNames = ROLE_PRESETS.map((p) => p.name);
  // Read once, so a render never sees the clock move (a takeover ends today by default).
  const [now] = useState(Date.now);

  const pickPreset = (p: RolePreset) => {
    setStart(p.id);
    if (!name.trim() || presetNames.includes(name.trim())) setName(p.name);
    setLevel(p.base_level);
    setOn(p.on(baseCapabilities(matrix, p.base_level)));
    setLastDay(p.ends ? today(now) : '');
  };

  const pickBuiltIn = () => {
    setStart(BUILT_IN);
    if (presetNames.includes(name.trim())) setName('');
    setOn(baseCapabilities(matrix, level));
    setLastDay('');
  };

  const pickLevel = (next: number) => {
    // Keep the role's changes from its old built-in role on top of the new one.
    const { granted, revoked } = overridesFor(baseCapabilities(matrix, level), on);
    const kept = [...baseCapabilities(matrix, next).filter((c) => !revoked.includes(c)), ...granted];
    setOn(next >= ADMIN ? [...new Set([...kept, 'staff'])] : kept);
    setLevel(next);
    if (next >= ADMIN) setLastDay('');
  };

  const save = () => {
    if (missingName || busy) return;
    onSave({
      id: role?.role_id ?? undefined,
      name,
      base_level: level,
      ...overridesFor(baseCaps, on),
      ends_at: lastDay && level < ADMIN ? endOfDay(lastDay) : null,
    });
  };

  return (
    <MenuSheet
      visible={visible}
      onClose={onClose}
      title={role ? `Edit ${role.name ?? 'role'}` : 'New role'}
      save={{ label: 'Save', onPress: save, disabled: busy || missingName }}
      footer={
        error || role ? (
          <View style={styles.footer}>
            {error ? <Caption color={STATUS.danger} role="alert">{error}</Caption> : null}
            {role ? <Button label="Delete role" variant="danger" disabled={busy} onPress={() => onDelete(role)} /> : null}
          </View>
        ) : undefined
      }
    >
      <Field label="Name" value={name} onChangeText={setName} placeholder="Barback, Head bartender, Guest bartender" maxLength={40} />
      {role ? null : (
        <View style={styles.list}>
          <Caption tone="muted" role="heading">Start from</Caption>
          <View role="radiogroup" accessibilityLabel="Start from" style={styles.pills}>
            {ROLE_PRESETS.map((p) => (
              <Choice key={p.id} label={p.name} pill="outline" selected={start === p.id} disabled={busy} onPress={() => pickPreset(p)} />
            ))}
            <Choice label="A built-in role" pill="outline" selected={start === BUILT_IN} disabled={busy} onPress={pickBuiltIn} />
          </View>
        </View>
      )}
      {start === BUILT_IN ? (
        <View role="radiogroup" accessibilityLabel="Starts from" style={styles.list}>
          <Caption tone="muted" role="heading">STARTS FROM</Caption>
          {ROLE_LEVELS.filter((r) => allowAdmin || r.level < ADMIN).map((r) => (
            <Choice key={r.level} label={roleLabel(r.level)} selected={level === r.level} disabled={busy} onPress={() => pickLevel(r.level)} />
          ))}
        </View>
      ) : null}
      {level < ADMIN ? (
        <DateField
          label="Ends"
          value={lastDay}
          onChange={setLastDay}
          clearable
          placeholder="No end date"
          hint="They lose access on their own at midnight after this day."
        />
      ) : null}
      {CAPABILITY_GROUPS.map((g) => (
        <View key={g.title} style={styles.list}>
          <Caption tone="muted" role="heading">{g.title.toUpperCase()}</Caption>
          {g.rows.map((r, i) => {
            const locked = isLocked({ base_level: level }, r.id);
            const value = locked || on.includes(r.id);
            const changed = value !== baseCaps.includes(r.id);
            return (
              <View key={r.id}>
                {i > 0 ? <RowDivider /> : null}
                <SwitchRow
                  label={r.label}
                  detail={locked ? 'An Admin always keeps this' : changed ? `Changed from ${roleLabel(level)}` : r.detail}
                  value={value}
                  disabled={busy || locked}
                  onValueChange={(next) => setOn((list) => (next ? [...list, r.id] : list.filter((c) => c !== r.id)))}
                />
              </View>
            );
          })}
        </View>
      ))}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  footer: { gap: space.sm },
});
