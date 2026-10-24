import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, useDs } from '@/components/ds';
import { PageHeader, usePageColumn } from '@/components/nav/Page';
import { InviteTeamCard, useOpenTeam, useTeamCard } from '@/components/nav/TeamCard';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useVenueMenus } from '@/hooks/useMenus';
import { useMode } from '@/hooks/useMode';
import { useVenueFeature } from '@/hooks/useVenueFeatures';
import { groupMenus } from '@/lib/menus';
import { roleLabel } from '@/lib/roles';

import { MenuGroupList } from './MenuGroupList';
import { NewMenuSheet } from './NewMenuSheet';

/**
 * Every menu at the venue: on now, coming up, drafts, past and R&D. The Menus
 * tab (`tab`), and opened from Tonight and the venue menu. In home mode (or
 * with no venue) it's the person's own menus, reached from Collection, in the
 * same groups (menus-one-look). The two never mix.
 */
export function MenusScreen({ tab = false }: { tab?: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const column = usePageColumn();
  // Back from a venue's menus goes to its first tab: Tonight, or Library when Tonight is off.
  const first = useVenueFeature('tonight') ? 'Tonight' : 'Library';
  const userId = useUserId();
  const { active, isLoading: venuesLoading } = useActiveVenue();
  const home = useMode().mode === 'home';
  const barId = home ? null : (active?.id ?? null);
  const { data: menus = [], isLoading, error } = useVenueMenus(barId);
  const caps = useCapabilities(barId);
  const canBuild = Array.isArray(caps.data) && caps.data.includes('menus');
  const { data: opensAt } = useCapabilityOpensAt(barId, 'menus');
  const [now] = useState(() => Date.now());
  // New → Menu arrives with ?new=1 and opens straight into the new menu sheet.
  const [creating, setCreating] = useState(useLocalSearchParams<{ new?: string }>().new === '1');
  // Anyone can make their own menu; a venue's needs Drink Creator or up.
  const canCreate = canBuild || !barId;

  // The same groups in both modes: a venue's menus, or with none, your own.
  const own = menus.filter((m) => (barId ? m.barId === barId : m.barId === null && m.createdBy === userId));
  const venue = groupMenus(own, now);
  // The venue leads: "Little Rye · 1 on now · 2 coming up".
  const summary = [
    barId ? (active?.name ?? null) : 'For nights in',
    venue.on.length ? `${venue.on.length} on now` : null,
    venue.upcoming.length ? `${venue.upcoming.length} coming up` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={[column, styles.content, { paddingBottom: (tab ? tabBarInset : insets.bottom) + space.xxxl }]}>
        <PageHeader
          title="Menus"
          display
          subtitle={summary}
          onBack={tab ? undefined : () => (router.canGoBack() ? router.back() : router.navigate(barId ? '/' : '/collection'))}
          backLabel={barId ? `Back to ${first}` : 'Back'}
          backText={barId ? first : 'Collection'}
          crumbs={tab ? undefined : [barId ? { label: first, href: '/' } : { label: 'Collection', href: '/collection' }]}
          actionOnTop
          action={canCreate ? <Button label="New menu" icon="plus" onPress={() => setCreating(true)} /> : null}
        />

        {error ? <Body tone="muted">Couldn’t load the menus. Pull down or come back in a moment.</Body> : null}
        {!isLoading && !venuesLoading && !error && menus.length === 0 ? (
          <>
            <Body tone="muted">
              {barId ? `${active?.name ?? 'This venue'} has no menus yet.` : 'Plan a night in: pick the drinks, then share the menu with your guests.'}
            </Body>
            <InviteIfAlone barId={barId} />
          </>
        ) : null}

        <MenuGroupList menus={own} now={now} canBuild={canBuild || !barId} opensAt={opensAt ? roleLabel(opensAt) : undefined} />
      </ScrollView>
      {creating && canCreate ? <NewMenuSheet visible onClose={() => setCreating(false)} menus={menus} now={now} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.lg },
});

/** An empty venue's Menus asks an Admin alone on the team to invite people (venue-library-empty-admin). */
function InviteIfAlone({ barId }: { barId: string | null }) {
  const { alone } = useTeamCard(barId);
  const openTeam = useOpenTeam();
  return alone ? <InviteTeamCard onInvite={() => openTeam(true)} /> : null;
}
