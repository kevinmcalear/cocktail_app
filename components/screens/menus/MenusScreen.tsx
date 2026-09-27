import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Caption, Display, GlassButton, LockedSection, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useAuth } from '@/ctx/AuthContext';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities, useCapabilityOpensAt } from '@/hooks/useCapabilities';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useVenueMenus } from '@/hooks/useMenus';
import { groupMenus, plural } from '@/lib/menus';
import { roleLabel } from '@/lib/roles';

import { MenuCard, MenuListRow } from './MenuRows';

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
 * Every menu at the venue: on now, coming up, drafts and previous, plus the
 * person's own menus. Reached from Tonight and, on wide web, the sidebar.
 */
export function MenusScreen() {
  const ds = useDs();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const sidebar = useIsWideWeb();
  const userId = useAuth().user?.id ?? null;
  const { active, isLoading: venuesLoading } = useActiveVenue();
  const barId = active?.id ?? null;
  const { data: menus = [], isLoading, error } = useVenueMenus(barId);
  const caps = useCapabilities(barId);
  const canBuild = Array.isArray(caps.data) && caps.data.includes('menus');
  const { data: opensAt } = useCapabilityOpensAt(barId, 'menus');
  const [now] = useState(() => Date.now());

  const venue = groupMenus(menus.filter((m) => m.barId === barId), now);
  const mine = menus.filter((m) => m.barId === null && m.createdBy === userId);
  const summary = [
    active?.name,
    venue.on.length ? `${venue.on.length} on now` : null,
    venue.upcoming.length ? `${venue.upcoming.length} coming up` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + (sidebar ? space.xxl : space.sm), paddingHorizontal: gutter, paddingBottom: insets.bottom + space.xxxl, maxWidth: wide ? 760 : undefined },
        ]}
      >
        {sidebar ? null : (
          <GlassButton icon="chevron.left" accessibilityLabel="Back to Tonight" onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))} />
        )}
        <View style={styles.title}>
          <Display>Menus</Display>
          {summary ? <Caption tone="muted">{summary}</Caption> : null}
        </View>

        {error ? <Body tone="muted">Couldn’t load the menus. Pull down or come back in a moment.</Body> : null}
        {!isLoading && !venuesLoading && !error && menus.length === 0 ? (
          <Body tone="muted">
            {barId ? `${active?.name ?? 'This venue'} has no menus yet.` : 'Once a venue adds you to its team, its menus show here.'}
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
        {mine.length ? (
          <Group title="Just yours">
            {mine.map((m) => (
              <MenuListRow key={m.id} menu={m} now={now} />
            ))}
          </Group>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', alignSelf: 'center', gap: space.lg },
  title: { gap: space.xs },
  group: { gap: space.sm },
  groupTitle: { letterSpacing: 1.5 },
});
