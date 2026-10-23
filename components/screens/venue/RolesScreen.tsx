import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, Surface, useDs, useGutter, useToast } from '@/components/ds';
import { SubPageHead, usePageFrame } from '@/components/nav/PageFrame';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { RowDivider } from '@/components/screens/settings/SettingsParts';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import {
  useDeleteVenueRole, useResetBuiltInRole, useRoleMatrix, useSaveVenueRole, useSetRoleCapability, type RoleMatrixRow,
} from '@/hooks/useVenueRoles';
import { useCanManageStaff, useEffectiveRole } from '@/hooks/useViewAs';
import { plainDbMessage } from '@/lib/dbError';
import { confirmAsync } from '@/lib/dialogs';
import { endsLabel, toggleLine } from '@/lib/roleMatrix';
import { roleLabel } from '@/lib/roles';
import { memberRoleName, personName } from '@/lib/team';

import { RoleMatrixTable } from './RoleMatrixTable';
import { RoleSheet } from './RoleSheet';

const ADMIN = 40;

/** The sheet that's open: a new role, or one to edit. */
type Editing = { role: RoleMatrixRow | null } | null;

function problem(error: unknown): string | null {
  if (!error) return null;
  const e = error as { code?: string; message?: string };
  if (e.code === '23505') return 'There’s already a role with that name.';
  if (e.code === '23514' && /staff/.test(e.message ?? '')) return 'An Admin always keeps Invite and manage staff.';
  // The role guards say why in their own words (P0001, below); a bare policy refusal doesn't.
  if (e.code === '42501') return 'Only people who can invite and manage staff change roles.';
  return plainDbMessage(error) ?? "Couldn't save that. Check your connection and try again.";
}

/**
 * Roles and access (board fix 14, tap a dot): every built-in role and the
 * venue's own side by side, what each can do, and the guest staff whose
 * access ends on its own. Members can look; people with staff tap a dot to
 * switch it for that role here (with Undo), reset a built-in role, and add
 * and edit roles.
 */
export function RolesScreen({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const frame = usePageFrame('wide');
  const tabBarInset = useTabBarInset();
  const venue = useActiveVenue().venues.find((v) => v.id === barId);
  const barName = venue?.name ?? 'This venue';
  const manage = useCanManageStaff(barId);
  const admin = useEffectiveRole(barId) >= ADMIN;
  const myCaps = useCapabilities(barId).data;
  const wide = useIsWideWeb();
  const toast = useToast();
  const matrix = useRoleMatrix(barId);
  const members = useBarMembers(barId);
  const save = useSaveVenueRole(barId);
  const remove = useDeleteVenueRole(barId);
  const toggle = useSetRoleCapability(barId);
  const reset = useResetBuiltInRole(barId);
  const [editing, setEditing] = useState<Editing>(null);

  const columns = matrix.data ?? [];
  const guests = (members.data ?? []).filter((m) => m.role_ends_at).sort((a, b) => (a.role_ends_at ?? '').localeCompare(b.role_ends_at ?? ''));
  const firstGuestRole = columns.find((c) => c.role_id && c.ends_at && guests.some((g) => g.venue_role_id === c.role_id)) ?? null;
  const firstEnd = endsLabel(guests[0]?.role_ends_at);

  const close = () => {
    setEditing(null);
    save.reset();
    remove.reset();
  };

  const roleName = (c: RoleMatrixRow) => (c.role_id ? (c.name ?? 'This role') : roleLabel(c.base_level));
  // mutateAsync, not mutate: quick taps queue, and mutate's own callbacks would only fire for the last one.
  const flip = (c: RoleMatrixRow, capability: string, on: boolean, undo = true) =>
    toggle.mutateAsync({ roleId: c.role_id, level: c.base_level, capability, on }).then(
      () =>
        undo
          ? toast.show({ title: toggleLine(roleName(c), capability, on), action: { label: 'Undo', onPress: () => void flip(c, capability, !on, false) } })
          : undefined,
      (e: unknown) => toast.show({ title: problem(e) ?? 'Couldn’t change that.' }),
    );
  const resetRole = (c: RoleMatrixRow) =>
    reset.mutate(c.base_level, {
      onSuccess: (done) => toast.show({ title: done ? `${roleName(c)} is back to built in` : `Nothing to reset: ${roleName(c)} is already built in` }),
      onError: (e) => toast.show({ title: problem(e) ?? 'Couldn’t reset that.' }),
    });
  // Someone with staff who isn't an Admin can't change Admin roles (the database refuses), so they aren't offered.
  const canChange = (c: RoleMatrixRow) => admin || c.base_level < ADMIN;

  const deleteRole = async (role: RoleMatrixRow) => {
    const ok = await confirmAsync({
      title: `Delete ${role.name}?`,
      message: 'Anyone with this role keeps its base level.',
      confirmText: 'Delete',
      destructive: true,
    });
    if (ok && role.role_id) remove.mutate(role.role_id, { onSuccess: close });
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Roles and access</title>
      </WebHead>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingTop: frame.top, paddingBottom: tabBarInset + space.xxxl, paddingHorizontal: gutter }}
      >
        <View style={[frame.column, styles.page]}>
          <SubPageHead
            title={wide ? `What each ${barName} role can do` : 'Roles and access'}
            crumbs={[
              { label: 'Venue settings', href: `/settings/bar/${barId}` as Href },
              { label: 'Roles and access', href: `/settings/bar/${barId}/roles` as Href },
            ]}
            onBack={() => (router.canGoBack() ? router.back() : router.replace(`/settings/bar/${barId}` as Href))}
            subtitle={
              <Body tone="muted">
                {manage
                  ? `Tap a dot to change it for that role at ${barName}. Built-in roles can change too; Reset to built in puts them back.`
                  : `What each role can do at ${barName}. People who invite and manage staff change them here.`}
              </Body>
            }
            trailing={
              // Off until the matrix is in: the ready-made roles start from the built-in roles' permissions here.
              manage ? <Button label="New role" icon="plus" disabled={!matrix.data} onPress={() => setEditing({ role: null })} /> : null
            }
          />

          {matrix.isLoading ? <Caption tone="muted">Loading the roles…</Caption> : null}
          {matrix.error ? <Body tone="muted">Couldn’t load the roles. Check your connection and try again.</Body> : null}
          {columns.length ? (
            <RoleMatrixTable
              matrix={columns}
              barName={barName}
              onEdit={manage ? (role) => setEditing({ role }) : undefined}
              onToggle={manage ? (c, capability, on) => void flip(c, capability, on) : undefined}
              onReset={manage ? resetRole : undefined}
              canChange={canChange}
              busy={reset.isPending}
            />
          ) : null}

          {guests.length ? (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Headline role="heading">Guest staff</Headline>
                {manage && firstGuestRole && canChange(firstGuestRole) ? (
                  <Button label="Change end date" variant="ghost" onPress={() => setEditing({ role: firstGuestRole })} />
                ) : null}
              </View>
              <Body tone="muted">
                {`${guests.length === 1 ? 'One guest loses' : `${guests.length} guests lose`} access on their own${firstEnd ? `, starting after ${firstEnd}` : ''}. Nobody has to remember to remove them.`}
              </Body>
              <Surface style={styles.card}>
                {guests.map((g, i) => (
                  <View key={g.user_id}>
                    {i > 0 ? <RowDivider /> : null}
                    <View style={styles.row}>
                      <UserAvatar uri={g.avatar_url} name={personName(g)} email={g.email} size={40} />
                      <View style={styles.text}>
                        <Body numberOfLines={1}>{personName(g)}</Body>
                        <Caption tone="muted" numberOfLines={1}>{memberRoleName(g)}</Caption>
                      </View>
                      <Caption tone="muted">{`until ${endsLabel(g.role_ends_at)}`}</Caption>
                    </View>
                  </View>
                ))}
              </Surface>
            </View>
          ) : null}
        </View>
      </ScrollView>
      {editing ? (
        <RoleSheet
          key={editing.role?.role_id ?? 'new'}
          visible
          role={editing.role}
          matrix={columns}
          allowAdmin={admin}
          canGive={admin ? null : (myCaps ?? [])}
          busy={save.isPending || remove.isPending}
          error={problem(save.error) ?? problem(remove.error)}
          onClose={close}
          onSave={(draft) => save.mutate(draft, { onSuccess: close })}
          onDelete={(role) => void deleteRole(role)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { gap: space.xl },
  section: { gap: space.sm, maxWidth: layout.page.text },
  sectionHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  card: { paddingVertical: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  text: { flex: 1, minWidth: 0, gap: 2 },
});
