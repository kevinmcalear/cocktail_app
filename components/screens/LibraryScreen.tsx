import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Display, DrinkImage, PressableScale, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { MatchClassicsNudge } from '@/components/screens/classics/MatchClassicsNudge';
import { SwapSheet } from '@/components/screens/library/SwapSheet';
import { radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { usePricedItemIds } from '@/hooks/usePricing';
import { useSearchCatalog } from '@/hooks/useSearchCatalog';
import { venueContextIds } from '@/lib/barContextFilter';
import { heroPicture } from '@/lib/itemImages';
import { fallbackGlass, itemHref, type ItemCategory } from '@/lib/itemRoutes';

type LibraryFilter = ItemCategory | 'NeedsPrice';

const FILTERS: { value: LibraryFilter; label: string }[] = [
  { value: 'Cocktail', label: 'Cocktails' },
  { value: 'Ingredient', label: 'Ingredients' },
  { value: 'Beer', label: 'Beer' },
  { value: 'Wine', label: 'Wine' },
];
/** Ingredients the venue has no pack price for yet; shown with the costs capability. */
const NEEDS_PRICE: { value: LibraryFilter; label: string } = { value: 'NeedsPrice', label: 'Needs a price' };

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
  // The venue in the header, not the old sidebar's multi-select contexts.
  const { active, isLoading: venuesLoading } = useActiveVenue();
  const activeId = active?.id ?? null;
  const contextIds = useMemo(() => venueContextIds(activeId, venuesLoading), [activeId, venuesLoading]);
  const { items, isLoading } = useSearchCatalog(contextIds);
  const [filter, setFilter] = useState<LibraryFilter>('Cocktail');
  const { data: capabilities, isLoading: capsLoading } = useCapabilities(activeId);
  const canCost = !!capabilities?.includes('costs');
  const canEdit = !!capabilities?.includes('edit_drinks');
  const [swap, setSwap] = useState(false);
  const { data: pricedIds } = usePricedItemIds(activeId, canCost);

  const published = useMemo(() => items.filter((i) => !i.isDraft), [items]);
  const needsPrice = useMemo(() => {
    const priced = new Set(pricedIds ?? []);
    return canCost ? published.filter((i) => i.category === 'Ingredient' && !priced.has(i.id)) : [];
  }, [published, pricedIds, canCost]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { NeedsPrice: needsPrice.length };
    for (const i of published) if (i.category) c[i.category] = (c[i.category] ?? 0) + 1;
    return c;
  }, [published, needsPrice]);
  const shown = useMemo(
    () => (filter === 'NeedsPrice' ? needsPrice : published.filter((i) => i.category === filter)).sort((a, b) => a.name.localeCompare(b.name)),
    [published, needsPrice, filter]
  );
  const filters = canCost ? [...FILTERS, NEEDS_PRICE] : FILTERS;
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
            {active && active.roleLevel > 30 ? <MatchClassicsNudge barId={active.id} /> : null}
            <View role="radiogroup" accessibilityLabel="Show" style={styles.filters}>
              {filters.map((f) => (
                <Filter key={f.value} label={f.label} count={counts[f.value] ?? 0} selected={filter === f.value} onPress={() => setFilter(f.value)} />
              ))}
            </View>
            {filter === 'Ingredient' && activeId ? (
              canEdit ? (
                <Button label="Swap a bottle" variant="secondary" onPress={() => setSwap(true)} style={styles.swap} />
              ) : capsLoading ? null : (
                <Caption tone="muted">Swapping a bottle opens at Drink Creator.</Caption>
              )
            ) : null}
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
                source={heroPicture(item.item_images)?.url ?? null}
                glass={fallbackGlass(category)}
                accessibilityLabel={item.name}
                hideTag
              />
              <Body numberOfLines={2}>{item.name}</Body>
            </PressableScale>
          );
        }}
        ListEmptyComponent={venuesLoading || isLoading ? undefined : <Body tone="muted">Nothing here yet.</Body>}
      />
      {swap && activeId ? <SwapSheet barId={activeId} onClose={() => setSwap(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { gap: space.md, paddingBottom: space.sm },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  filter: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, justifyContent: 'center' },
  swap: { alignSelf: 'flex-start' },
  tile: { flex: 1, gap: space.sm },
});
