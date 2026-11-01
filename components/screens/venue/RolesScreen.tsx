import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, useDs, useGutter } from '@/components/ds';
import { SubPageHead, usePageFrame } from '@/components/nav/PageFrame';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { RowDivider, SettingsRow, SettingsSection } from '@/components/screens/settings/SettingsParts';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useRoleMatrix, useSaveVenueRole, type RoleMatrixRow } from '@/hooks/useVenueRoles';
import { useCanManageStaff, useEffectiveRole } from '@/hooks/useViewAs';
import { rolesListLine } from '@/lib/roleMatrix';
import { roleLabel } from '@/lib/roles';

import { RoleSheet } from './RoleSheet';
import { roleKey, roleProblem, rolesInOrder } from './roleParts';

const ADMIN = 40;

/**
 * Roles (Kept-team): every role at the venue, highest first, with what it
 * sees and does and how many people hold it. A role opens its page of
 * switches (RolePage); people who manage the team add a New role.
 */
export function RolesScreen({ barId }: { barId: string }) {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const frame = usePageFrame();
  const tabBarInset = useTabBarInset();
  const venue = useActiveVenue().venues.find((v) => v.id === barId);
  const barName = venue?.name ?? 'This venue';
  const manage = useCanManageStaff(barId);
  const admin = useEffectiveRole(barId) >= ADMIN;
  const myCaps = useCapabilities(barId).data;
  const matrix = useRoleMatrix(barId);
  const members = useBarMembers(barId).data ?? [];
  const save = useSaveVenueRole(barId);
  // Setup's Add a role (?new=1) opens straight onto New role.
  const [adding, setAdding] = useState(!!useLocalSearchParams<{ new?: string }>().new);

  const roles = rolesInOrder(matrix.data ?? [], members);
  const holders = (r: RoleMatrixRow) => members.filter((m) => (r.role_id ? m.venue_role_id === r.role_id : !m.venue_role_id && m.role_level === r.base_level)).length;
  const close = () => {
    setAdding(false);
    save.reset();
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Roles</title>
      </WebHead>
      <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: frame.top, paddingBottom: tabBarInset + space.xxxl, paddingHorizontal: gutter }}>
        <View style={[frame.column, styles.page]}>
          <SubPageHead
            title="Roles"
            crumbs={[{ label: 'Bar settings', href: `/settings/bar/${barId}` as Href }]}
            onBack={() => (router.canGoBack() ? router.back() : router.replace(`/settings/bar/${barId}` as Href))}
            subtitle={<Body tone="muted">{`What each role sees and does at ${barName}. ${manage ? 'You' : 'Admins'} can change any of them.`}</Body>}
            // Off until the matrix is in: a new role starts from the built-in roles' permissions.
            trailing={manage ? <Button label="New role" icon="plus" variant="secondary" disabled={!matrix.data} onPress={() => setAdding(true)} /> : null}
          />
          {matrix.isLoading ? <Caption tone="muted">Loading the roles…</Caption> : null}
          {matrix.error ? <Body tone="muted" role="alert">Couldn’t load the roles. Check your connection and try again.</Body> : null}
          {roles.length ? (
            <SettingsSection>
              {roles.map((r, i) => (
                <View key={roleKey(r)}>
                  {i > 0 ? <RowDivider /> : null}
                  <SettingsRow
                    label={r.role_id ? (r.name ?? 'Role') : roleLabel(r.base_level)}
                    detail={rolesListLine(r)}
                    value={String(holders(r))}
                    onPress={() => router.push(`/settings/bar/${barId}/roles/${roleKey(r)}` as Href)}
                  />
                </View>
              ))}
            </SettingsSection>
          ) : null}
        </View>
      </ScrollView>
      {adding && matrix.data ? (
        <RoleSheet
          visible
          role={null}
          matrix={matrix.data}
          allowAdmin={admin}
          canGive={admin ? null : (myCaps ?? [])}
          busy={save.isPending}
          error={roleProblem(save.error)}
          onClose={close}
          onSave={(draft) => save.mutate(draft, { onSuccess: close })}
          onDelete={() => {}}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { gap: space.xl },
});
