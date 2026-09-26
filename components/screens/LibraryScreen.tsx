import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Body, Caption, Display, DrinkImage, PressableScale, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { radius, space } from '@/constants/tokens';
import { useSearchCatalog } from '@/hooks/useSearchCatalog';
import { fallbackGlass, itemHref, type ItemCategory } from '@/lib/itemRoutes';

const FILTERS: { value: ItemCategory; label: string }[] = [
  { value: 'Cocktail', label: 'Cocktails' },
  { value: 'Ingredient', label: 'Ingredients' },
  { value: 'Beer', label: 'Beer' },
  { value: 'Wine', label: 'Wine' },
];

const COLUMNS = { phone: 2, tablet: 3, desktop: 5 } as const;

function Filter({ label, count, selected, onPress }: { label: string; count: number; selected: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale
      role="radio"
      aria-selected={selected}
      accessibilityLabel={`${label}, ${count}`}
      onPress={onPress}
      style={[styles.filter, { backgroundColor: selected ? ds.c.ink : ds.c.raised }]}
    >
      <Caption color={selected ? ds.c.ground : ds.c.ink}>
        {label} <Caption color={selected ? ds.c.ground : ds.c.muted}>{count}</Caption>
      </Caption>
    </PressableScale>
  );
}

/**
 * Library: everything the venue has, by type. Drinks without a photo still get
 * a proper tile (their glass on sketch paper), never someone else's photo.
 */
export function LibraryScreen() {
  const ds = useDs();
  const router = useRouter();
  const gutter = useGutter();
  const breakpoint = useBreakpoint();
  const bottom = useTabBarInset();
  const { items } = useSearchCatalog();
  const [filter, setFilter] = useState<ItemCategory>('Cocktail');

  const published = useMemo(() => items.filter((i) => !i.isDraft), [items]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of published) if (i.category) c[i.category] = (c[i.category] ?? 0) + 1;
    return c;
  }, [published]);
  const shown = useMemo(
    () => published.filter((i) => i.category === filter).sort((a, b) => a.name.localeCompare(b.name)),
    [published, filter]
  );
  const columns = COLUMNS[breakpoint];

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <FlatList
        key={columns}
        data={shown}
        numColumns={columns}
        keyExtractor={(i) => i.id}
        columnWrapperStyle={{ gap: space.md }}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom, gap: space.lg }}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={{ marginHorizontal: -gutter }}>
              <ScreenHeader />
            </View>
            <Display>Library</Display>
            <View role="radiogroup" accessibilityLabel="Show" style={styles.filters}>
              {FILTERS.map((f) => (
                <Filter key={f.value} label={f.label} count={counts[f.value] ?? 0} selected={filter === f.value} onPress={() => setFilter(f.value)} />
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const category = item.category as ItemCategory;
          return (
            <PressableScale
              accessibilityLabel={`${item.name}, open`}
              onPress={() => router.push(itemHref(category, item.id) as never)}
              style={[styles.tile, { maxWidth: `${100 / columns}%` }]}
            >
              <DrinkImage
                source={item.item_images?.[0]?.images?.url ?? null}
                glass={fallbackGlass(category)}
                accessibilityLabel={item.name}
                hideTag
              />
              <Body numberOfLines={2}>{item.name}</Body>
            </PressableScale>
          );
        }}
        ListEmptyComponent={<Body tone="muted">Nothing here yet.</Body>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { gap: space.md, paddingBottom: space.sm },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  filter: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center' },
  tile: { flex: 1, gap: space.sm },
});
