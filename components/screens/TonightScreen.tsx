import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { Body, Caption, Display, DrinkImage, Headline, PressableScale, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useTonight, type TonightDrink } from '@/hooks/useTonight';
import { itemHref } from '@/lib/itemRoutes';

function today(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

function DrinkRow({ drink }: { drink: TonightDrink }) {
  const ds = useDs();
  const router = useRouter();
  return (
    <PressableScale
      accessibilityLabel={`${drink.name}, open`}
      onPress={() => router.push(itemHref(drink.category, drink.id) as never)}
      style={[styles.row, { borderBottomColor: ds.c.line }]}
    >
      <View style={styles.thumb}>
        <DrinkImage source={drink.imageUrl} glass={drink.glass} accessibilityLabel={drink.name} radius="control" hideTag />
      </View>
      <View style={styles.rowText}>
        <Headline numberOfLines={1}>{drink.name}</Headline>
        {drink.category !== 'Cocktail' ? <Caption tone="muted">{drink.category}</Caption> : null}
      </View>
    </PressableScale>
  );
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
        renderItem={({ item }) => <DrinkRow drink={item} />}
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

// ScreenHeader handles its own safe-area padding and gutter, so it sits outside
// the list's horizontal padding.
function ScreenHeaderSpacer() {
  const gutter = useGutter();
  return (
    <View style={{ marginHorizontal: -gutter }}>
      <ScreenHeader />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { gap: space.xs, paddingBottom: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 56 },
  rowText: { flex: 1, gap: 2 },
  empty: { gap: space.sm, paddingVertical: space.xl },
});
