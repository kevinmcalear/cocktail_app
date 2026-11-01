import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Caption, useDs, useGutter, useToast } from '@/components/ds';
import { SubPageHead, usePageFrame } from '@/components/nav/PageFrame';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { RowDivider, SectionHeading, SettingsRow, SettingsSection, SwitchRow } from '@/components/screens/settings/SettingsParts';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useDeleteVenueRole, useResetBuiltInRole, useRoleMatrix, useSaveVenueRole, useSetRoleCapability, type RoleMatrixRow } from '@/hooks/useVenueRoles';
import { useCanManageStaff, useEffectiveRole } from '@/hooks/useViewAs';
import { confirmAsync } from '@/lib/dialogs';
import { CAPABILITY_GROUPS, isChangedBuiltIn, isLocked, toggleLine, withinReach } from '@/lib/roleMatrix';
import { roleLabel } from '@/lib/roles';

import { RoleSheet } from './RoleSheet';
import { roleFromKey, roleProblem } from './roleParts';

const ADMIN = 40;

/**
 * A role (Kept-team, A role): how many hold it, and what it sees, makes and
 * runs as switches. A switch saves at once, with Undo. People who manage the
 * team change it; an Admin's own team switch stays on. A venue's own role
 * also renames, ends or goes; a changed built-in role goes back to built in.
 */
export function RolePage({ barId, roleKey }: { barId: string; roleKey: string }) {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const frame = usePageFrame();
  const tabBarInset = useTabBarInset();
  const toast = useToast();
  const manage = useCanManageStaff(barId);
  const admin = useEffectiveRole(barId) >= ADMIN;
  const myCaps = useCapabilities(barId).data;
  const matrix = useRoleMatrix(barId);
  const members = useBarMembers(barId).data ?? [];
  const toggle = useSetRoleCapability(barId);
  const reset = useResetBuiltInRole(barId);
  const save = useSaveVenueRole(barId);
  const remove = useDeleteVenueRole(barId);
  const [editing, setEditing] = useState(false);
  const role = roleFromKey(matrix.data ?? [], roleKey);
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/settings/bar/${barId}/roles` as Href));

  if (!role) {
    return (
      <View style={[styles.screen, { backgroundColor: ds.c.ground, paddingTop: frame.top, paddingHorizontal: gutter }]}>
        <SubPageHead title="Role" onBack={back} />
        {matrix.isLoading ? <Caption tone="muted">Loading the role…</Caption> : <Body tone="muted" role="alert">{matrix.error ? 'Couldn’t load the role. Check your connection and try again.' : 'This role isn’t here any more.'}</Body>}
      </View>
    );
  }

  const name = role.role_id ? (role.name ?? 'Role') : roleLabel(role.base_level);
  const held = members.filter((m) => (role.role_id ? m.venue_role_id === role.role_id : !m.venue_role_id && m.role_level === role.base_level)).length;
  // Someone with staff who isn't an Admin can't change Admin roles, or give what they can't do (the database refuses).
  const canChange = manage && (admin || role.base_level < ADMIN);
  const mine = admin ? null : (myCaps ?? []);
  // mutateAsync, not mutate: quick taps queue, and mutate's own callbacks would only fire for the last one.
  const flip = (r: RoleMatrixRow, capability: string, on: boolean, undo = true): Promise<void> =>
    toggle.mutateAsync({ roleId: r.role_id, level: r.base_level, capability, on }).then(
      () => {
        if (undo) toast.show({ title: toggleLine(name, capability, on), action: { label: 'Undo', onPress: () => void flip(r, capability, !on, false) } });
      },
      (e: unknown) => {
        toast.show({ title: roleProblem(e) ?? 'Couldn’t change that.' });
      },
    );
  const resetRole = () =>
    reset.mutate(role.base_level, {
      onSuccess: (done) => toast.show({ title: done ? `${name} is back to built in` : `Nothing to reset: ${name} is already built in` }),
      onError: (e) => toast.show({ title: roleProblem(e) ?? 'Couldn’t reset that.' }),
    });
  const deleteRole = async () => {
    const ok = await confirmAsync({ title: `Delete ${name}?`, message: 'Anyone with this role keeps its base level.', confirmText: 'Delete', destructive: true });
    if (ok && role.role_id) remove.mutate(role.role_id, { onSuccess: () => { setEditing(false); back(); } });
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>{name}</title>
      </WebHead>
      <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: frame.top, paddingBottom: tabBarInset + space.xxxl, paddingHorizontal: gutter }}>
        <View style={[frame.column, styles.page]}>
          <SubPageHead
            title={name}
            crumbs={[{ label: 'Bar settings', href: `/settings/bar/${barId}` as Href }, { label: 'Roles', href: `/settings/bar/${barId}/roles` as Href }]}
            onBack={back}
            subtitle={<Caption tone="muted" style={styles.caps}>{`Role · ${held} ${held === 1 ? 'person' : 'people'}`}</Caption>}
          />
          {CAPABILITY_GROUPS.map((g) => (
            <View key={g.title} style={styles.group}>
              <SectionHeading>{g.title}</SectionHeading>
              <SettingsSection>
                {g.rows.map((c, i) => {
                  const locked = isLocked(role, c.id);
                  const on = locked || role.capabilities.includes(c.id);
                  const outOfReach = !on && !withinReach([c.id], mine);
                  return (
                    <View key={c.id}>
                      {i > 0 ? <RowDivider /> : null}
                      <SwitchRow
                        label={c.label}
                        detail={locked ? 'An Admin always keeps this' : outOfReach && canChange ? 'You can only give what you can do' : c.detail}
                        value={on}
                        disabled={!canChange || locked || outOfReach}
                        onValueChange={(next) => void flip(role, c.id, next)}
                      />
                    </View>
                  );
                })}
              </SettingsSection>
            </View>
          ))}
          {canChange && role.role_id ? (
            <SettingsSection>
              <SettingsRow label="Name, end date or delete" onPress={() => setEditing(true)} />
            </SettingsSection>
          ) : null}
          {canChange && isChangedBuiltIn(role) ? (
            <SettingsSection note={`Puts ${name} back to what it can do everywhere.`}>
              <SettingsRow label="Reset to built in" role="button" busy={reset.isPending} onPress={resetRole} />
            </SettingsSection>
          ) : null}
          {manage ? null : <Caption tone="muted">People who manage the team change roles.</Caption>}
        </View>
      </ScrollView>
      {editing && matrix.data ? (
        <RoleSheet
          visible
          role={role}
          matrix={matrix.data}
          allowAdmin={admin}
          canGive={mine}
          busy={save.isPending || remove.isPending}
          error={roleProblem(save.error) ?? roleProblem(remove.error)}
          onClose={() => setEditing(false)}
          onSave={(draft) => save.mutate(draft, { onSuccess: () => setEditing(false) })}
          onDelete={() => void deleteRole()}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { gap: space.xl },
  group: { gap: space.sm },
  caps: { textTransform: 'uppercase', letterSpacing: 1.2 },
});
