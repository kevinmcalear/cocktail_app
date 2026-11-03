import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Caption, GlassButton, useDs } from '@/components/ds';
import { PageHeader, usePageColumn } from '@/components/nav/Page';
import { InviteTeamCard, useOpenTeam, useTeamCard } from '@/components/nav/TeamCard';
import { font, space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useVenueMenus } from '@/hooks/useMenus';
import { useVenueFeature } from '@/hooks/useVenueFeatures';
import { useMode } from '@/hooks/useMode';
import { roleLabel } from '@/lib/roles';

import { MenuGroupList } from './MenuGroupList';
import { NewMenuSheet } from './NewMenuSheet';

/**
 * Every menu at the venue: on now, coming up, drafts, past and R&D. Opened from
 * Tonight, Drinks and the venue menu. In home mode (or
 * with no venue) it's the person's own menus, reached from Drinks, in the
 * same groups (menus-one-look). The two never mix.
 */
export function MenusScreen() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const column = usePageColumn();
  // Back from a venue's menus goes to its first tab: Tonight, or Drinks where Tonight is switched off.
  const tonight = useVenueFeature('tonight');
  const first = tonight ? 'Tonight' : 'Drinks';
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
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={[column, styles.content, { paddingBottom: insets.bottom + space.xxxl }]}>
        <PageHeader
          title="Menus"
          display
          above={
            <Caption tone="muted" style={styles.eyebrow}>
              {(barId ? (active?.name ?? '') : 'At home').toUpperCase()}
            </Caption>
          }
          onBack={() => (router.canGoBack() ? router.back() : router.navigate(barId ? '/' : '/drinks'))}
          backLabel={barId ? `Back to ${first}` : 'Back'}
          backText={barId ? first : 'Drinks'}
          crumbs={[barId && tonight ? { label: first, href: '/' } : { label: 'Drinks', href: '/drinks' }]}
          actionOnTop
          action={canCreate ? <GlassButton icon="plus" accessibilityLabel="New menu" onPress={() => setCreating(true)} /> : null}
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

        <MenuGroupList
          menus={own}
          now={now}
          canBuild={canBuild || !barId}
          opensAt={opensAt ? roleLabel(opensAt) : undefined}
          pastShown={PAST_SHOWN}
          onAllPast={() => router.push('/menus/past')}
        />
      </ScrollView>
      {creating && canCreate ? <NewMenuSheet visible onClose={() => setCreating(false)} menus={menus} now={now} /> : null}
    </View>
  );
}

const PAST_SHOWN = 2;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.xl },
  eyebrow: { letterSpacing: 1.5, ...font.medium },
});

/** An empty venue's Menus asks an Admin alone on the team to invite people (venue-library-empty-admin). */
function InviteIfAlone({ barId }: { barId: string | null }) {
  const { alone } = useTeamCard(barId);
  const openTeam = useOpenTeam();
  return alone ? <InviteTeamCard onInvite={() => openTeam(true)} /> : null;
}
