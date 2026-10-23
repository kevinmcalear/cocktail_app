import { useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, useDs, useGutter } from '@/components/ds';
import { SubPageHead, usePageFrame } from '@/components/nav/PageFrame';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { RoleMatrixTable, type MatrixLegend, type MatrixRowSpec } from '@/components/screens/venue/RoleMatrixTable';
import { WebHead } from '@/components/WebHead';
import { space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useBarMembers } from '@/hooks/useBarDetail';
import { useRoleMatrix, type RoleMatrixRow } from '@/hooks/useVenueRoles';
import { useCanManageStaff, useEffectiveRole } from '@/hooks/useViewAs';
import { defaultColumns, LENS_GROUPS, lensValue, type LensRow } from '@/lib/roleLens';

const LEGEND: MatrixLegend = {
  yes: 'Opens',
  no: 'Locked: stays on the page, collapsed, and says who opens it',
  lock: 'Follows the built-in role',
};

/**
 * Who sees what on a venue drink (board drink-role-lens), in the Roles and
 * access layout (Eddie, 13 Oct): the venue's roles as columns, the drink's
 * sections as rows, from the venue's own role matrix, so a venue that moved
 * specs or a role that grants more shows here. Your column says You. Before
 * the matrix loads, or for a drink with no venue, the base levels' defaults.
 */
export function RoleLensScreen({ itemId, barId, name }: { itemId: string; barId: string | null; name: string | null }) {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const frame = usePageFrame('wide');
  const tabBarInset = useTabBarInset();
  const venue = useActiveVenue().venues.find((v) => v.id === barId);
  const barName = venue?.name ?? 'this venue';
  const mine = useEffectiveRole(barId);
  const manage = useCanManageStaff(barId);
  const matrix = useRoleMatrix(barId);
  const columns: RoleMatrixRow[] = matrix.data?.length ? matrix.data : defaultColumns();
  const drink = name ?? 'this drink';
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/cocktail/${itemId}` as Href));
  // Your column: your venue role if you hold one, else your level; viewing as another level marks that one.
  const userId = useUserId();
  const myRoleId = (useBarMembers(barId).data ?? []).find((m) => m.user_id === userId)?.venue_role_id ?? null;
  const viewingAs = !!venue && mine !== venue.roleLevel;
  const isYou = (c: RoleMatrixRow) => (myRoleId && !viewingAs ? c.role_id === myRoleId : c.role_id === null && c.base_level === mine);
  const rowOf = (r: MatrixRowSpec) => r as LensRow;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <WebHead>
        <title>Who sees what</title>
      </WebHead>
      <ScrollView style={styles.screen} contentContainerStyle={{ paddingTop: frame.top, paddingBottom: tabBarInset + space.xxxl, paddingHorizontal: gutter }}>
        <View style={[frame.column, styles.page]}>
          <SubPageHead
            title="Who sees what"
            crumbs={[{ label: drink, href: `/cocktail/${itemId}` as Href }]}
            onBack={back}
            subtitle={
              <Body tone="muted">{`Every section of ${drink} and who opens it at ${barName}: the base levels and the venue’s own roles. It follows Roles and access, so changing a role there changes this.`}</Body>
            }
            trailing={barId && manage ? <Button label="Roles and access" variant="secondary" onPress={() => router.push(`/settings/bar/${barId}/roles` as Href)} /> : null}
          />
          {matrix.error ? <Caption tone="muted">Couldn’t load this venue’s roles, so these are the default levels.</Caption> : null}
          <RoleMatrixTable
            matrix={columns}
            barName={barName}
            groups={LENS_GROUPS}
            cellOf={(c, r) => lensValue(columns, c, rowOf(r))}
            label={`Who sees each section of ${drink} at ${barName}`}
            heading="What they see"
            legend={LEGEND}
            isYou={isYou}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { gap: space.xl },
});
