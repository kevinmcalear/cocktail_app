import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, LockedSection, useDs } from '@/components/ds';
import { PageHeader, usePageColumn } from '@/components/nav/Page';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { fontFamilies, space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useVenueMenus } from '@/hooks/useMenus';
import { useMode } from '@/hooks/useMode';
import { useVenueFeature } from '@/hooks/useVenueFeatures';
import { groupMenus, plural } from '@/lib/menus';
import { roleLabel } from '@/lib/roles';

import { MenuCard, MenuListRow, MenuPastLine } from './MenuRows';
import { NewMenuSheet } from './NewMenuSheet';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Caption tone="muted" role="heading" style={styles.groupTitle}>
        {title.toUpperCase()}
      </Caption>
      {children}
    </View>
  );
}

/**
 * Every menu at the venue: on now, coming up, drafts and previous. The Menus
 * tab (`tab`), and opened from Tonight and the venue menu. In home mode (or
 * with no venue) it's the person's own menus, reached from Collection. The
 * two never mix.
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

  const venue = groupMenus(barId ? menus.filter((m) => m.barId === barId) : [], now);
  const mine = barId ? [] : menus.filter((m) => m.barId === null && m.createdBy === userId);
  // The venue leads: "Little Rye · 1 on now · 2 coming up".
  const summary = [
    barId ? (active?.name ?? null) : null,
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
          display={!!barId}
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
          <Body tone="muted">
            {barId ? `${active?.name ?? 'This venue'} has no menus yet.` : 'Plan a night in: pick the drinks, then share the menu with your guests.'}
          </Body>
        ) : null}

        {venue.on.length ? (
          <Group title="On now">
            {venue.on.map((m) => (
              <MenuCard key={m.id} menu={m} now={now} />
            ))}
          </Group>
        ) : null}
        {venue.upcoming.length ? (
          <Group title="Coming up">
            {venue.upcoming.map((m) => (
              <MenuListRow key={m.id} menu={m} now={now} />
            ))}
          </Group>
        ) : null}
        {venue.draft.length && barId ? (
          canBuild ? (
            <Group title="Drafts">
              {venue.draft.map((m) => (
                <MenuListRow key={m.id} menu={m} now={now} />
              ))}
            </Group>
          ) : (
            <LockedSection
              title={`Drafts · ${plural(venue.draft.length, 'menu')}`}
              unlocked={false}
              opensAt={opensAt ? roleLabel(opensAt) : 'Drink Creator'}
            >
              {null}
            </LockedSection>
          )
        ) : null}
        {venue.previous.length ? (
          <Group title="Previous">
            <View>
              {venue.previous.map((m) => (
                <MenuPastLine key={m.id} menu={m} />
              ))}
            </View>
          </Group>
        ) : null}
        {venue.rnd.length && barId && canBuild ? (
          <Group title="R&D">
            {venue.rnd.map((m) => (
              <MenuListRow key={m.id} menu={m} now={now} />
            ))}
          </Group>
        ) : null}
        {mine.length ? (
          <Group title="Your menus">
            {mine.map((m) => (
              <MenuListRow key={m.id} menu={m} now={now} />
            ))}
          </Group>
        ) : null}
      </ScrollView>
      {creating && canCreate ? <NewMenuSheet visible onClose={() => setCreating(false)} menus={menus} now={now} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.lg },
  group: { gap: space.sm },
  groupTitle: { letterSpacing: 1.5, fontFamily: fontFamilies.mono },
});
