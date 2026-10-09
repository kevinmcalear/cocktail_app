import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button, Caption, LockedSection, useDs } from '@/components/ds';
import { PageHeader, usePageColumn } from '@/components/nav/Page';
import { space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useVenueMenus } from '@/hooks/useMenus';
import { useMode } from '@/hooks/useMode';
import { groupMenus, plural } from '@/lib/menus';
import { roleLabel } from '@/lib/roles';

import { MenuCard, MenuListRow } from './MenuRows';
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
 * Every menu at the venue: on now, coming up, drafts and previous. Reached
 * from Tonight and, on wide web, the sidebar. In home mode (or with no venue)
 * it's the person's own menus, reached from Collection. The two never mix.
 */
export function MenusScreen() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const column = usePageColumn();
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
  // Not the venue's name: the sidebar and the chip already say it.
  const summary = [
    venue.on.length ? `${venue.on.length} on now` : null,
    venue.upcoming.length ? `${venue.upcoming.length} coming up` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={[column, styles.content, { paddingBottom: insets.bottom + space.xxxl }]}>
        <PageHeader
          title="Menus"
          subtitle={summary}
          onBack={() => (router.canGoBack() ? router.back() : router.navigate(barId ? '/' : '/collection'))}
          backLabel={barId ? 'Back to Tonight' : 'Back'}
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
            {venue.previous.map((m) => (
              <MenuListRow key={m.id} menu={m} now={now} />
            ))}
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
      {creating ? <NewMenuSheet visible onClose={() => setCreating(false)} menus={menus} now={now} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.lg },
  group: { gap: space.sm },
  groupTitle: { letterSpacing: 1.5 },
});
