import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Display, DrinkImage, PressableScale, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { MatchClassicsNudge } from '@/components/screens/classics/MatchClassicsNudge';
import { StaffList } from '@/components/screens/library/StaffList';
import { SwapSheet } from '@/components/screens/library/SwapSheet';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useVenueMenus } from '@/hooks/useMenus';
import { usePricedItemIds } from '@/hooks/usePricing';
import { useSearchCatalog } from '@/hooks/useSearchCatalog';
import { useStaffList } from '@/hooks/useStaffList';
import { venueContextIds } from '@/lib/barContextFilter';
import { heroPicture } from '@/lib/itemImages';
import { fallbackGlass, itemHref, type ItemCategory } from '@/lib/itemRoutes';
import { DRINK_CATEGORIES, itemIdOf, LIST_FILTERS, menuDrinks, NEEDS_PRICE, parseShow, TYPE_FILTERS, type Show } from '@/lib/libraryFilters';

const COLUMNS = { phone: 2, tablet: 3, desktop: 5 } as const;

/** A row of filters on one line that scrolls sideways, edge to edge. */
function FilterRow({ label, gutter, children }: { label: string; gutter: number; children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      role="radiogroup"
      accessibilityLabel={label}
      style={{ marginHorizontal: -gutter }}
      contentContainerStyle={[styles.filters, { paddingHorizontal: gutter }]}
    >
      {children}
    </ScrollView>
  );
}

function Filter({ label, count, selected, onPress }: { label: string; count?: number; selected: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale
      role="radio"
      aria-checked={selected}
      accessibilityLabel={count == null ? label : `${label}, ${count}`}
      onPress={onPress}
      style={[styles.filter, selected ? { backgroundColor: ds.accentFill.fill, borderColor: ds.accentFill.fill } : { borderColor: ds.c.lineStrong }]}
    >
      <Body color={selected ? ds.accentFill.text : ds.c.ink} style={selected ? styles.picked : undefined}>
        {label} {count == null ? null : <Body color={selected ? ds.accentFill.text : ds.c.muted}>{count}</Body>}
      </Body>
    </PressableScale>
  );
}

/**
 * Library: the venue's one list of drinks. All of them, what's on the menu
 * now (one menu or every one that's on), the staff list (ranked, with cut
 * lines), what was on past menus, and each type on its own. The filter lives
 * in the URL (?show=staff&menu=<id>), so a link opens the same view. Drinks
 * without a photo still get a proper tile, never someone else's photo.
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
  const params = useLocalSearchParams<{ show?: string; menu?: string }>();
  const show = parseShow(params.show, !!activeId || venuesLoading);
  const contextIds = useMemo(() => venueContextIds(activeId, venuesLoading), [activeId, venuesLoading]);
  const { items, isLoading } = useSearchCatalog(contextIds);
  const { data: capabilities, isLoading: capsLoading } = useCapabilities(activeId);
  const canCost = !!capabilities?.includes('costs');
  const canEdit = !!capabilities?.includes('edit_drinks');
  const canOrder = !!capabilities?.includes('menus');
  const [swap, setSwap] = useState(false);
  const { data: pricedIds } = usePricedItemIds(activeId, canCost);
  const { data: menus } = useVenueMenus(activeId);
  const staff = useStaffList(activeId);
  const [now] = useState(() => Date.now());

  const published = useMemo(() => items.filter((i) => !i.isDraft), [items]);
  const byMenu = useMemo(
    () => menuDrinks((menus ?? []).filter((m) => m.barId === activeId), now, params.menu ?? null),
    [menus, activeId, now, params.menu]
  );
  const lists = useMemo(() => {
    const priced = new Set(pricedIds ?? []);
    const inSet = (ids: string[]) => {
      const set = new Set(ids);
      return published.filter((i) => set.has(itemIdOf(i.id)));
    };
    const out: Record<Show, typeof published> = {
      all: published.filter((i) => i.category && DRINK_CATEGORIES.includes(i.category as ItemCategory)),
      'on-menu': inSet(byMenu.on),
      staff: [],
      past: inSet(byMenu.past),
      cocktails: [],
      ingredients: [],
      beer: [],
      wine: [],
      'needs-price': canCost ? published.filter((i) => i.category === 'Ingredient' && !priced.has(i.id)) : [],
    };
    for (const f of TYPE_FILTERS) out[f.value] = published.filter((i) => i.category === f.category);
    return out;
  }, [published, pricedIds, canCost, byMenu]);
  const onNow = useMemo(() => new Set(byMenu.onNow), [byMenu]);
  const past = useMemo(() => new Set(byMenu.past), [byMenu]);
  const shown = useMemo(() => [...lists[show]].sort((a, b) => a.name.localeCompare(b.name)), [lists, show]);
  const count = (value: Show) => (value === 'staff' ? (staff.data?.length ?? 0) : lists[value].length);
  const filters = [...(activeId ? LIST_FILTERS : []), ...TYPE_FILTERS, ...(canCost ? [NEEDS_PRICE] : [])];
  const pick = (value: Show) => router.setParams({ show: value, menu: undefined });
  const columns = COLUMNS[breakpoint];
  const staffView = show === 'staff' && !!activeId;
  const content = { paddingHorizontal: gutter, paddingBottom: bottom, gap: space.lg };
  const header = (
    <View style={styles.header}>
      <View style={{ marginHorizontal: -gutter }}>
        <ScreenHeader />
      </View>
      <Display>Library</Display>
      {active && active.roleLevel > 30 ? <MatchClassicsNudge barId={active.id} /> : null}
      <FilterRow label="Show" gutter={gutter}>
        {filters.map((f) => (
          <Filter key={f.value} label={f.label} count={count(f.value)} selected={show === f.value} onPress={() => pick(f.value)} />
        ))}
      </FilterRow>
      {show === 'on-menu' && byMenu.onMenus.length > 1 ? (
        <FilterRow label="Which menu" gutter={gutter}>
          <Filter label="Every menu on now" selected={!byMenu.onMenus.some((m) => m.id === params.menu)} onPress={() => router.setParams({ menu: undefined })} />
          {byMenu.onMenus.map((m) => (
            <Filter key={m.id} label={m.name} count={m.itemIds.length} selected={params.menu === m.id} onPress={() => router.setParams({ menu: m.id })} />
          ))}
        </FilterRow>
      ) : null}
      {show === 'on-menu' && !byMenu.onMenus.length && menus ? <Caption tone="muted">No menu is on right now. Menus are built and scheduled in Menus.</Caption> : null}
      {show === 'past' ? <Caption tone="muted">Drinks from menus that have finished, and aren’t on one now.</Caption> : null}
      {show === 'ingredients' && activeId ? (
        canEdit ? (
          <Button label="Swap a bottle" variant="secondary" onPress={() => setSwap(true)} style={styles.start} />
        ) : capsLoading ? null : (
          <Caption tone="muted">Swapping a bottle opens at Drink Creator.</Caption>
        )
      ) : null}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {staffView && activeId ? (
        // The staff list drags to reorder, so it is the scroll view itself.
        <StaffList barId={activeId} canEdit={canOrder} onNow={onNow} past={past} header={header} contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom }} />
      ) : (
        <FlatList
          key={columns}
          data={shown}
          numColumns={columns}
          keyExtractor={(i) => i.id}
          columnWrapperStyle={{ gap: space.md }}
          contentContainerStyle={content}
          ListHeaderComponent={header}
          renderItem={({ item }) => {
            const category = item.category as ItemCategory;
            return (
              <PressableScale
                accessibilityLabel={`${item.name}, open`}
                onPress={() => router.push(itemHref(category, item.id) as never)}
                style={[styles.tile, { maxWidth: `${100 / columns}%` }]}
              >
                <DrinkImage
                  itemId={item.id}
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
      )}
      {swap && activeId ? <SwapSheet barId={activeId} onClose={() => setSwap(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { gap: space.md, paddingBottom: space.sm },
  filters: { flexDirection: 'row', gap: space.sm },
  filter: { minHeight: 38, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
  picked: { fontFamily: fontFamilies.bodySemiBold },
  start: { alignSelf: 'flex-start' },
  tile: { flex: 1, gap: space.sm },
});
