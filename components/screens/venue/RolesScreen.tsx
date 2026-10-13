import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline, Surface, useDs, useGutter } from '@/components/ds';
import { SubPageHead, usePageFrame } from '@/components/nav/PageFrame';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { RowDivider } from '@/components/screens/settings/SettingsParts';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { WebHead } from '@/components/WebHead';
import { layout, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useDeleteVenueRole, useRoleMatrix, useSaveVenueRole, type RoleMatrixRow } from '@/hooks/useVenueRoles';
import { useEffectiveRole } from '@/hooks/useViewAs';
import { plainDbMessage } from '@/lib/dbError';
import { confirmAsync } from '@/lib/dialogs';
import { endsLabel } from '@/lib/roleMatrix';
import { canManageTeam, memberRoleName, personName } from '@/lib/team';

import { RoleMatrixTable } from './RoleMatrixTable';
import { RoleSheet } from './RoleSheet';

/** The sheet that's open: a new role, or one to edit. */
type Editing = { role: RoleMatrixRow | null } | null;

function problem(error: unknown): string | null {
  if (!error) return null;
  const e = error as { code?: string };
  if (e.code === '23505') return 'There’s already a role with that name.';
  return plainDbMessage(error) ?? "Couldn't save that. Check your connection and try again.";
}

/**
 * Roles and access (canvas tools-roles-desktop): every base level and the
 * venue's own roles side by side, what each can do, and the guest staff whose
 * access ends on its own. Members can look; Admins add and edit roles.
 */
export function RolesScreen({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const frame = usePageFrame('wide');
  const tabBarInset = useTabBarInset();
  const venue = useActiveVenue().venues.find((v) => v.id === barId);
  const barName = venue?.name ?? 'This venue';
  const manage = canManageTeam(useEffectiveRole(barId));
  const matrix = useRoleMatrix(barId);
  const members = useBarMembers(barId);
  const save = useSaveVenueRole(barId);
  const remove = useDeleteVenueRole(barId);
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
            title="Roles and access"
            crumbs={[{ label: 'Venue settings', href: `/settings/bar/${barId}` as Href }]}
            onBack={() => (router.canGoBack() ? router.back() : router.replace(`/settings/bar/${barId}` as Href))}
            subtitle={<Body tone="muted">Every role starts from one of five base levels. Change what it can do, and the drink page and the back bar follow.</Body>}
            trailing={manage ? <Button label="New role" icon="plus" onPress={() => setEditing({ role: null })} /> : null}
          />

          {matrix.isLoading ? <Caption tone="muted">Loading the roles…</Caption> : null}
          {matrix.error ? <Body tone="muted">Couldn’t load the roles. Check your connection and try again.</Body> : null}
          {columns.length ? (
            <RoleMatrixTable matrix={columns} barName={barName} onEdit={manage ? (role) => setEditing({ role }) : undefined} />
          ) : null}

          {guests.length ? (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Headline role="heading">Guest staff</Headline>
                {manage && firstGuestRole ? (
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
