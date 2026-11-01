import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, DateField, Field } from '@/components/ds';
import { Choice, MenuSheet } from '@/components/screens/menus/MenuSheet';
import { RowDivider, SwitchRow } from '@/components/screens/settings/SettingsParts';
import { STATUS } from '@/constants/palette';
import { space } from '@/constants/tokens';
import type { RoleMatrixRow, VenueRoleDraft } from '@/hooks/useVenueRoles';
import {
  baseCapabilities, CAPABILITY_GROUPS, dayOfEnd, DRINK_TYPES, drinkTypesToSave, endOfDay, isLocked, limitTo, overridesFor, ROLE_PRESETS, today, withinReach,
  type DrinkType, type RolePreset,
} from '@/lib/roleMatrix';
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
export function RoleSheet({ role, matrix, allowAdmin = true, canGive = null, visible, busy, error, onClose, onSave, onDelete }: {
  /** The role to edit, or null for a new one. */
  role: RoleMatrixRow | null;
  matrix: RoleMatrixRow[];
  /** Off for someone with staff who isn't an Admin: the database refuses Admin roles from them. */
  allowAdmin?: boolean;
  /** What they may hand out (their own permissions), or null for an Admin: nothing more is offered. */
  canGive?: string[] | null;
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
  // What the role already has may stay; anything new must be something they can do (the database's rule).
  const had = role?.capabilities ?? [];
  const reach = (caps: string[]) => limitTo(caps, canGive, had);
  const [on, setOn] = useState<string[]>(role?.capabilities ?? reach(first.on(baseCapabilities(matrix, first.base_level))));
  const [lastDay, setLastDay] = useState(dayOfEnd(role?.ends_at));
  // What it adds (tf-059): every kind, or some. Only asked when it edits drinks.
  const allKinds = DRINK_TYPES.map((t) => t.id);
  const [kinds, setKinds] = useState<DrinkType[]>((role ? (role.drink_types as DrinkType[] | null | undefined) : first.drinkTypes) ?? allKinds);
  const toggleKind = (k: DrinkType) => setKinds((list) => (list.includes(k) ? (list.length > 1 ? list.filter((x) => x !== k) : list) : [...list, k]));
  const baseCaps = baseCapabilities(matrix, level);
  const missingName = !name.trim();
  const presetNames = ROLE_PRESETS.map((p) => p.name);
  // Read once, so a render never sees the clock move (a takeover ends today by default).
  const [now] = useState(Date.now);

  const pickPreset = (p: RolePreset) => {
    setStart(p.id);
    if (!name.trim() || presetNames.includes(name.trim())) setName(p.name);
    setLevel(p.base_level);
    setOn(reach(p.on(baseCapabilities(matrix, p.base_level))));
    setLastDay(p.ends ? today(now) : '');
    setKinds(p.drinkTypes ?? allKinds);
  };

  const pickBuiltIn = () => {
    setStart(BUILT_IN);
    if (presetNames.includes(name.trim())) setName('');
    setOn(reach(baseCapabilities(matrix, level)));
    setLastDay('');
    setKinds(allKinds);
  };

  const pickLevel = (next: number) => {
    // Keep the role's changes from its old built-in role on top of the new one.
    const { granted, revoked } = overridesFor(baseCapabilities(matrix, level), on);
    const kept = [...baseCapabilities(matrix, next).filter((c) => !revoked.includes(c)), ...granted];
    setOn(next >= ADMIN ? [...new Set([...kept, 'staff'])] : reach(kept));
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
      drink_types: on.includes('edit_drinks') && level < ADMIN ? drinkTypesToSave(kinds) : null,
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
            const outOfReach = !value && !withinReach([r.id], canGive, had);
            return (
              <View key={r.id}>
                {i > 0 ? <RowDivider /> : null}
                <SwitchRow
                  label={r.label}
                  detail={locked ? 'An Admin always keeps this' : outOfReach ? 'You can only give what you can do' : changed ? `Changed from ${roleLabel(level)}` : r.detail}
                  value={value}
                  disabled={busy || locked || outOfReach}
                  onValueChange={(next) => setOn((list) => (next ? [...list, r.id] : list.filter((c) => c !== r.id)))}
                />
              </View>
            );
          })}
        </View>
      ))}
      {on.includes('edit_drinks') && level < ADMIN ? (
        <View style={styles.list}>
          <Caption tone="muted" role="heading">DRINKS THEY ADD</Caption>
          <View role="group" accessibilityLabel="Drinks they add" style={styles.pills}>
            {DRINK_TYPES.map((t) => (
              <Choice key={t.id} kind="checkbox" label={t.label} pill="outline" selected={kinds.includes(t.id)} disabled={busy} onPress={() => toggleKind(t.id)} />
            ))}
          </View>
          <Caption tone="muted">
            {drinkTypesToSave(kinds)
              ? 'They only edit or delete these. Cocktails include house-made ingredients. What they add waits for approval from someone who edits every kind.'
              : 'Every kind of drink.'}
          </Caption>
        </View>
      ) : null}
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  footer: { gap: space.sm },
});
