import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Display, GlassButton, Headline, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { MenuCard } from '@/components/screens/menus/MenuRows';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useVenueMenus } from '@/hooks/useMenus';
import { useTonight } from '@/hooks/useTonight';
import { itemHref } from '@/lib/itemRoutes';
import { groupMenus } from '@/lib/menus';

function today(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * Tonight: what's pouring at this venue, in running order. Replaces Home in
 * the redesign. One job: am I ready for tonight?
 */
export function TonightScreen() {
  const ds = useDs();
  const gutter = useGutter();
  const wide = useBreakpoint() !== 'phone';
  const bottom = useTabBarInset();
  const { active, isLoading: venuesLoading } = useActiveVenue();
  const router = useRouter();
  const { drinks, isLoading } = useTonight(active?.id ?? null);
  const { data: venueMenus = [] } = useVenueMenus(active?.id);
  const [now] = useState(() => Date.now());
  const onNow = groupMenus(venueMenus.filter((m) => m.barId === active?.id), now).on;
  const openMenus = () => router.push('/menus/all');

  const empty = !venuesLoading && !isLoading && drinks.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <FlatList
        data={drinks}
        keyExtractor={(d) => `${d.menuId}-${d.id}`}
        renderItem={({ item }) => (
          <DrinkRow
            name={item.name}
            href={itemHref(item.category, item.id)}
            imageUrl={item.imageUrl}
            glass={item.glass}
            caption={item.category !== 'Cocktail' ? item.category : undefined}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom, maxWidth: wide ? 760 : undefined, width: '100%', alignSelf: 'center' }}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeaderSpacer />
            <View style={styles.titleRow}>
              <Display>Tonight</Display>
              <View style={styles.titleActions}>
                {active ? <GlassButton icon="list.bullet" label="Menus" accessibilityLabel="All menus" onPress={openMenus} /> : null}
              </View>
            </View>
            <Caption tone="muted">{today()}</Caption>
            {onNow.map((m) => (
              <MenuCard key={m.id} menu={m} now={now} />
            ))}
          </View>
        }
        ListEmptyComponent={
          empty ? (
            <View style={styles.empty}>
              <Headline>{active ? `No current menu at ${active.name}` : 'No venue yet'}</Headline>
              <Body tone="muted">
                {active
                  ? 'When a menu is set as current, its drinks show here in running order.'
                  : 'Once a venue adds you to its team, tonight’s menu shows here.'}
              </Body>
              {active ? <Button label="See all menus" variant="secondary" onPress={openMenus} style={styles.emptyButton} /> : null}
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { gap: space.sm, paddingBottom: space.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  titleActions: { flexDirection: 'row', gap: space.sm },
  emptyButton: { alignSelf: 'flex-start', marginTop: space.sm },
  empty: { gap: space.sm, paddingVertical: space.xl },
});
