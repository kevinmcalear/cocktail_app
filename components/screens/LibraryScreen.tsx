import { useLocalSearchParams, useRouter } from 'expo-router';
import { lazy, Suspense, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Button, Caption, Chip, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { PageHeader } from '@/components/nav/Page';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { useWebNav } from '@/hooks/useIsWideWeb';
import { DRAWN_LIST_WINDOW } from '@/components/ds/SketchDrawing';
import { BottlePhotoSheet } from '@/components/screens/bottles/BottlePhotoSheet';
import { MatchClassicsNudge } from '@/components/screens/classics/MatchClassicsNudge';
import { ResumeCard } from '@/components/screens/bringin/ResumeCard';
import { FeatureNewsLine } from '@/components/screens/library/FeatureNewsLine';
import { FirstRoundCard, RoundOpened } from '@/components/screens/firstRound/FirstRoundCard';
import { useFirstRound } from '@/hooks/useFirstRound';
import { FilterRow } from '@/components/screens/library/LibraryChips';
import { FILTER_DOCK, FilterDock, PinnedTitle, type FilterSet } from '@/components/screens/library/LibraryFilters';
import { LibraryEmpty } from '@/components/screens/library/LibraryEmpty';
import { LibraryPanes } from '@/components/screens/library/LibraryPanes';
import { LibraryTile } from '@/components/screens/library/LibraryTile';
import { SearchField } from '@/components/search/SearchField';
import { SwapSheet } from '@/components/screens/library/SwapSheet';
import { layout, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useVenueMenus } from '@/hooks/useMenus';
import { usePricedItemIds } from '@/hooks/usePricing';
import { useSearchCatalog } from '@/hooks/useSearchCatalog';
import { useStaffList } from '@/hooks/useStaffList';
import { useVenueFeature } from '@/hooks/useVenueFeatures';
import { venueContextIds } from '@/lib/barContextFilter';
import { itemHref, type ItemCategory } from '@/lib/itemRoutes';
import { matchesQuery } from '@/lib/publicDrinks';
import { BATCHED_STYLES, DRINK_CATEGORIES, filterGroups, itemIdOf, menuDrinks, methodWord, parseShow, PREP_GROUPS, splitFilters, tileLine, TYPE_FILTERS, type Show } from '@/lib/libraryFilters';
import { usePrepFacts, useVenueShelves } from '@/hooks/useVenueShelves';
import type { SearchItem } from '@/types/search';
import { usePrefetchCocktail } from '@/hooks/useCocktails';

// The staff list drags to reorder, with gesture and animation code the rest of the
// Library doesn't need: it loads when Classics is picked.
const StaffList = lazy(() => import('@/components/screens/library/StaffList').then((m) => ({ default: m.StaffList })));

const COLUMNS = { phone: 2, tablet: 3, desktop: 5 } as const;

/**
 * Library: the venue's spec book. All its drinks, Classics (the staff list,
 * ranked, with cut lines), what's on the menu now (one menu or every one
 * that's on), Old drinks (on past menus), beer and wine. With More library
 * filters on, R&D and the shelves too: drinks poured from a batch, preps,
 * garnishes and bottles. Without a venue, each type on its own. The filter lives
 * in the URL (?show=staff&menu=<id>), so a link opens the same view. Drinks
 * without a photo still get a proper tile, never someone else's photo.
 */
export function LibraryScreen() {
  const ds = useDs();
  const router = useRouter();
  const prefetch = usePrefetchCocktail();
  const gutter = useGutter();
  const breakpoint = useBreakpoint();
  const bottom = useTabBarInset();
  // A tablet beside the rail: the list and the picked drink side by side.
  const panes = useWebNav() === 'rail';
  // The venue in the header, not the old sidebar's multi-select contexts.
  const { active, isLoading: venuesLoading } = useActiveVenue();
  const activeId = active?.id ?? null;
  const params = useLocalSearchParams<{ show?: string; menu?: string; kind?: string }>();
  const extras = useVenueFeature('libraryExtras');
  const show = parseShow(params.show, !!activeId || venuesLoading, extras);
  const contextIds = useMemo(() => venueContextIds(activeId, venuesLoading), [activeId, venuesLoading]);
  const { items, isLoading } = useSearchCatalog(contextIds);
  const { data: capabilities, isLoading: capsLoading } = useCapabilities(activeId);
  const canCost = !!capabilities?.includes('costs');
  const canEdit = !!capabilities?.includes('edit_drinks');
  const canOrder = !!capabilities?.includes('menus');
  const [swap, setSwap] = useState(false);
  const [snapping, setSnapping] = useState(false);
  // Phones: four filters and a filter button in a glass dock above the tabs, no find field; the search circle opens on the venue.
  // Wider screens keep Find in Library in the header, narrowing the list in place (lib-filters-proposal).
  const phone = breakpoint === 'phone';
  const [find, setFind] = useState('');
  const q = phone ? '' : find.trim().toLowerCase();
  // Scrolled past the title, a phone pins a small one to the top (titleEnd: where the title ends in the list).
  const [titleEnd, setTitleEnd] = useState(0);
  const [pinned, setPinned] = useState(false);
  const onScrollY = (y: number) => setPinned(phone && !!titleEnd && y > titleEnd - layout.minTapTarget);
  // A new view opens at its top (Classics is its own list), so the title unpins.
  const [pinnedShow, setPinnedShow] = useState(show);
  if (pinnedShow !== show) {
    setPinnedShow(show);
    setPinned(false);
  }
  const { data: pricedIds } = usePricedItemIds(activeId, canCost);
  const { data: menus } = useVenueMenus(activeId);
  const staff = useStaffList(activeId);
  const { data: specs } = useDropdowns();
  const [now] = useState(() => Date.now());
  // The first round's first step points at the Old Fashioned.
  const startHere = useFirstRound().current?.key === 'house_spec';

  const published = useMemo(() => items.filter((i) => !i.isDraft), [items]);
  const shelves = useVenueShelves(activeId, published);
  const prepFacts = usePrepFacts(shelves.preps);
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
    const rnd = new Set(byMenu.rnd);
    const out: Record<Show, typeof published> = {
      // R&D (trials, a flight's control) has its own filter, out of All.
      all: published.filter((i) => i.category && DRINK_CATEGORIES.includes(i.category as ItemCategory) && !rnd.has(itemIdOf(i.id))),
      rnd: inSet(byMenu.rnd),
      'on-menu': inSet(byMenu.on),
      staff: [],
      past: inSet(byMenu.past),
      cocktails: [],
      ingredients: [],
      beer: [],
      wine: [],
      'needs-price': canCost ? published.filter((i) => i.category === 'Ingredient' && !priced.has(i.id)) : [],
      batched: published.filter((i) => i.category === 'Cocktail' && BATCHED_STYLES.includes(i.serviceStyle ?? '')),
      ...shelves,
    };
    // Cocktails are All's cocktails: R&D trials stay out here too.
    for (const f of TYPE_FILTERS) out[f.value] = published.filter((i) => i.category === f.category && !rnd.has(itemIdOf(i.id)));
    return out;
  }, [published, pricedIds, canCost, byMenu, shelves]);
  const onNow = useMemo(() => new Set(byMenu.onNow), [byMenu]);
  const past = useMemo(() => new Set(byMenu.past), [byMenu]);
  // Preps by what was done to them (Syrups, Cordials...): the groups this venue has.
  const prepKinds = PREP_GROUPS.map((g) => ({ ...g, count: lists.preps.filter((p) => prepFacts[p.id]?.group === g.group).length })).filter((g) => g.count);
  const kind = show === 'preps' ? prepKinds.find((g) => g.value === params.kind) : undefined;
  const inView = lists[show].filter((i) => !kind || prepFacts[i.id]?.group === kind.group);
  const shown = inView.filter((i) => !q || matchesQuery(i, q)).sort((a, b) => a.name.localeCompare(b.name));
  // "Stirred · Coupe"; R&D adds the collection; beer and wine say what they are; preps what was done, yield and keeps.
  const glassName = (i: SearchItem) => (i.glassware_id ? (specs?.glassware.find((g) => g.id === i.glassware_id)?.name ?? null) : null);
  const rndOf = useMemo(() => new Map(byMenu.rndMenus.flatMap((m) => m.itemIds.map((id) => [id, m.name] as const))), [byMenu]);
  const lineOf = (i: SearchItem): string | null => {
    if (i.category === 'Ingredient') return prepFacts[i.id]?.line ?? null;
    if (i.category === 'Beer' || i.category === 'Wine') return tileLine(i.category, glassName(i));
    const method = i.method_id ? methodWord(specs?.methods.find((m) => m.id === i.method_id)?.name) : null;
    return tileLine(method, glassName(i), show === 'rnd' ? rndOf.get(i.id) : null);
  };
  const count = (value: Show) => (value === 'staff' ? (staff.data?.length ?? 0) : lists[value].length);
  const groups = filterGroups(!!activeId, canCost, extras);
  const pick = (value: Show) => router.setParams({ show: value, menu: undefined, kind: undefined });
  const filterSet: FilterSet = { ...splitFilters(groups), show, count, onPick: pick };
  const columns = COLUMNS[breakpoint];
  const staffView = show === 'staff' && !!activeId;
  // The last tiles scroll clear of the phone's filter dock.
  const listBottom = bottom + (phone ? FILTER_DOCK : 0);
  const content = { paddingHorizontal: gutter, paddingBottom: listBottom, gap: space.lg };
  const header = (
    <View style={styles.header}>
      <View onLayout={(e) => setTitleEnd(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
        <PageHeader title="Library" width="full" display action={phone || staffView ? undefined : <SearchField query={find} onQuery={setFind} placeholder="Find in Library" />} />
      </View>
      {activeId ? <ResumeCard barId={activeId} /> : null}
      <FeatureNewsLine />
      <FirstRoundCard />
      {active && canEdit ? <MatchClassicsNudge barId={active.id} /> : null}
      {phone ? null : (
        <FilterRow label="Show" gutter={gutter} whole={breakpoint === 'desktop'} groups={groups.map((g) => g.map((f) => <Chip key={f.value} look="outline" label={f.label} count={String(count(f.value))} selected={show === f.value} onPress={() => pick(f.value)} />))} />
      )}
      {show === 'on-menu' && byMenu.onMenus.length > 1 ? (
        <FilterRow
          label="Which menu"
          gutter={gutter}
          groups={[[
            <Chip look="outline" key="all" label="Every menu on now" selected={!byMenu.onMenus.some((m) => m.id === params.menu)} onPress={() => router.setParams({ menu: undefined })} />,
            ...byMenu.onMenus.map((m) => <Chip look="outline" key={m.id} label={m.name} count={m.itemIds.length} selected={params.menu === m.id} onPress={() => router.setParams({ menu: m.id })} />),
          ]]}
        />
      ) : null}
      {show === 'on-menu' && !byMenu.onMenus.length && menus ? <Caption tone="muted">No menu is on right now. Menus are built and scheduled in Menus.</Caption> : null}
      {show === 'past' ? <Caption tone="muted">Drinks from menus that have finished, and aren’t on one now.</Caption> : null}
      {show === 'rnd' && byMenu.rndMenus.length > 1 ? (
        <FilterRow
          label="Which collection"
          gutter={gutter}
          groups={[[
            <Chip look="outline" key="all" label="Every R&D drink" selected={!byMenu.rndMenus.some((m) => m.id === params.menu)} onPress={() => router.setParams({ menu: undefined })} />,
            ...byMenu.rndMenus.map((m) => <Chip look="outline" key={m.id} label={m.name} count={m.itemIds.length} selected={params.menu === m.id} onPress={() => router.setParams({ menu: m.id })} />),
          ]]}
        />
      ) : null}
      {show === 'rnd' ? <Caption tone="muted">Trials, flights and assignments: drinks on an R&D collection and on no menu. They stay out of All and out of staff search.</Caption> : null}
      {show === 'preps' && prepKinds.length ? (
        <FilterRow
          label="Which preps"
          gutter={gutter}
          groups={[[
            <Chip look="outline" key="all" label="All preps" count={lists.preps.length} selected={!kind} onPress={() => router.setParams({ kind: undefined })} />,
            ...prepKinds.map((g) => <Chip look="outline" key={g.value} label={g.label} count={g.count} selected={kind?.value === g.value} onPress={() => router.setParams({ kind: g.value })} />),
          ]]}
        />
      ) : null}
      {show === 'preps' ? <Caption tone="muted">What the bar makes in house. Each one has its lines, steps, yield, storage and allergens.</Caption> : null}
      {show === 'batched' ? <Caption tone="muted">Drinks served bottled, carbonated, on draught or from a batch made ahead.</Caption> : null}
      {show === 'bottles' && activeId ? (
        canEdit ? (
          <View style={styles.actions}>
            <Button label="Snap a bottle" icon="camera.fill" variant="secondary" onPress={() => setSnapping(true)} />
            <Button label="Swap a bottle" variant="secondary" onPress={() => setSwap(true)} />
          </View>
        ) : capsLoading ? null : (
          <Caption tone="muted">Swapping a bottle opens at Drink Creator.</Caption>
        )
      ) : null}
      {q && !staffView && shown.length ? <Caption tone="muted">{`${shown.length} of ${inView.length}`}</Caption> : null}
    </View>
  );

  const found = find.trim();
  const empty = venuesLoading || isLoading ? null : q ? <Caption tone="muted">{`Nothing here called “${found}”.`}</Caption> : <LibraryEmpty barId={activeId} noDrinks={!published.length} canAdd={canEdit} />;
  // Past this list: the one search, everywhere, with what was typed.
  const foot = q ? (
    <View style={styles.foot}>
      <Button label={`Search everywhere for “${found}”`} icon="magnifyingglass" variant="secondary" onPress={() => router.push(`/search?scope=everywhere&q=${encodeURIComponent(found)}` as never)} />
    </View>
  ) : null;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {panes && !staffView ? (
        <LibraryPanes venueId={activeId} items={shown} lineOf={lineOf} header={header} empty={empty} footer={foot} />
      ) : staffView && activeId ? (
        // The staff list drags to reorder, so it is the scroll view itself.
        <Suspense fallback={<FlatList data={[]} renderItem={() => null} ListHeaderComponent={header} contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: listBottom }} />}>
          <StaffList barId={activeId} canEdit={canOrder} onNow={onNow} past={past} header={header} onScrollOffset={onScrollY} contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: listBottom }} />
        </Suspense>
      ) : (
        <FlatList
          key={columns}
          data={shown}
          numColumns={columns}
          // Rows, not tiles: a screen's worth first. The defaults (10 rows, 21
          // screens) drew every drink on open, which froze iOS for seconds.
          initialNumToRender={4}
          windowSize={DRAWN_LIST_WINDOW}
          keyExtractor={(i) => i.id}
          columnWrapperStyle={{ gap: space.md }}
          contentContainerStyle={content}
          ListHeaderComponent={header}
          onScroll={(e) => onScrollY(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={32}
          renderItem={({ item }) => {
            const category = item.category as ItemCategory;
            return (
              <LibraryTile
                item={item}
                line={lineOf(item)}
                glassName={glassName(item)}
                width={`${100 / columns}%`}
                mark={startHere && item.name.trim().toLowerCase() === 'old fashioned' ? 'Start here' : null}
                onPressIn={category === 'Cocktail' ? () => prefetch(item.id, { name: item.name, item_images: item.item_images }) : undefined}
                onPress={() => router.push(itemHref(category, item.id) as never)}
              />
            );
          }}
          ListEmptyComponent={empty ?? undefined}
          ListFooterComponent={foot ?? undefined}
        />
      )}
      {pinned ? <PinnedTitle /> : null}
      {phone ? <FilterDock set={filterSet} /> : null}
      <RoundOpened />
      {swap && activeId ? <SwapSheet barId={activeId} onClose={() => setSwap(false)} /> : null}
      {active ? <BottlePhotoSheet visible={snapping} target={{ kind: 'venue', barId: active.id, name: active.name, canEdit }} onClose={() => setSnapping(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { gap: space.md, paddingBottom: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  foot: { paddingTop: space.md, alignItems: 'flex-start' },
});
