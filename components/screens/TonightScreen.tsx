import { FlatList, StyleSheet, View } from 'react-native';

import { Body, Caption, Display, Headline, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { DrinkRow } from '@/components/screens/DrinkRow';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useTonight } from '@/hooks/useTonight';
import { itemHref } from '@/lib/itemRoutes';

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
  const { menus, drinks, isLoading } = useTonight(active?.id ?? null);

  const menuLine = menus.length ? menus.map((m) => m.name).join(' · ') : null;
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
            <Display>Tonight</Display>
            <Caption tone="muted">{[today(), menuLine].filter(Boolean).join(' · ')}</Caption>
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
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { gap: space.xs, paddingBottom: space.lg },
  empty: { gap: space.sm, paddingVertical: space.xl },
});
