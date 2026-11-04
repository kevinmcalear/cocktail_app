import { useNetInfo } from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { lazy, Suspense, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Button, Caption, Chip, PencilState, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { SectionLabel } from '@/components/ds/ListGroup';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { WebHead } from '@/components/WebHead';
import { useWebNav } from '@/hooks/useIsWideWeb';
import { DRAWN_LIST_WINDOW } from '@/components/ds/SketchDrawing';
import { BottlePhotoSheet } from '@/components/screens/bottles/BottlePhotoSheet';
import { MatchClassicsNudge } from '@/components/screens/classics/MatchClassicsNudge';
import { ResumeCard } from '@/components/screens/bringin/ResumeCard';
import { BottleChips, bottlesFor, ToOrder, useBottleFacts } from '@/components/screens/drinks/Bottles';
import { DrinkListRow, DrinksHead, DrinksLoading, OnNowCard } from '@/components/screens/drinks/DrinksParts';
import { HouseMadeTop } from '@/components/screens/drinks/HouseMade';
import { useStaffDrinks } from '@/components/screens/drinks/useStaffDrinks';
import { DrinksSetup } from '@/components/screens/venueSetup/SetupBanner';
import { FirstRoundCard, RoundOpened } from '@/components/screens/firstRound/FirstRoundCard';
import { FilterRow } from '@/components/screens/drinks/FilterRow';
import { DrinksEmpty } from '@/components/screens/drinks/DrinksEmpty';
import { DrinksPanes } from '@/components/screens/drinks/DrinksPanes';
import { NearResults } from '@/components/search/NearResultsLazy';
import { SearchField } from '@/components/search/SearchField';
import { space } from '@/constants/tokens';
import { useDrinksFirstRow } from '@/components/screens/drinks/firstRow';
import { useOpenSearch } from '@/hooks/useSearchFrom';
import { useDrinkLists } from '@/hooks/useDiscover';
import { usePrefetchCocktail } from '@/hooks/useCocktails';
import { CAPSULE_SHOW } from '@/lib/drinksTab';
import { itemHref, newDrinkHref, type ItemCategory } from '@/lib/itemRoutes';
import { capitalize } from '@/lib/stringUtils';
import { matchesQuery } from '@/lib/publicDrinks';
import type { SearchItem } from '@/types/search';

// The staff list drags to reorder, with gesture and animation code the rest of
// Drinks doesn't need: it loads when Classics is picked.
const StaffList = lazy(() => import('@/components/screens/drinks/StaffList').then((m) => ({ default: m.StaffList })));
// Swap a bottle's sheet loads when it's first opened.
const SwapSheet = lazy(() => import('@/components/screens/drinks/SwapSheet').then((m) => ({ default: m.SwapSheet })));

const NO_IDS: string[] = [];
const EVERYWHERE = { area: { kind: 'anywhere' }, kinds: ['drink', 'bar', 'person', 'ingredient'] } as const;

/**
 * The Drinks tab at a bar (Prod-phone drinks, Sta-drinks, Sta-capsules): the
 * bar's name over Drinks, the capsule (Drinks, House-made, Bottles), then
 * under Drinks the menu on now and the views (All, On menu, Classics, Old
 * drinks, R&D...), under House-made what's low and what's in the fridge,
 * under Bottles the kinds, counts and the order; then the rows, A to Z, each
 * a drawing, its name and line, a tag and a chevron. The view lives in the
 * URL (?show=staff&menu=<id>), so a link opens the same view. `beside`: the
 * list in its column beside the Drinks stack on a desktop
 * (components/nav/DrinksSplit.tsx), where a drink opens at its own URL.
 */
export function StaffDrinks({ beside = false }: { beside?: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const client = useQueryClient();
  // The palette on wide screens, the search tab on phones (q01).
  const openSearch = useOpenSearch();
  const prefetch = usePrefetchCocktail();
  const gutter = useGutter();
  const breakpoint = useBreakpoint();
  const bottom = useTabBarInset();
  // A tablet beside the rail: the list and the picked drink side by side. A desktop: the list, with the drink beside it.
  const nav = useWebNav();
  const panes = beside || nav === 'rail';
  const offline = useNetInfo().isConnected === false;
  const d = useStaffDrinks(beside);
  const { active, activeId, show, capsule, params, setView } = d;
  const canEdit = !!d.capabilities?.includes('edit_drinks');
  const canOrder = !!d.capabilities?.includes('menus');
  const [swap, setSwap] = useState(false);
  const [snapping, setSnapping] = useState(false);
  // Phones search from the search circle; wider screens narrow the list in place.
  const phone = breakpoint === 'phone';
  const [find, setFind] = useState('');
  const q = phone ? '' : find.trim().toLowerCase();
  const bottles = useBottleFacts(activeId, d.published);
  const inView = show === 'bottles' ? bottlesFor(d.inView, params.kind, bottles.low) : d.inView;
  const shown = inView.filter((i) => !q || matchesQuery(i, q)).sort((a, b) => a.name.localeCompare(b.name));
  const shownIds = shown.map((i) => i.id);
  const { data: classicList } = useDrinkLists(!!q);
  const staffView = show === 'staff' && !!activeId;
  // Beside the stack, /drinks shows this list's first row (none for Classics, whose order is its own), A to Z
  // before any search, so typing doesn't swap the page on every key; the list lights it only while it's shown.
  const first = staffView ? null : (inView.reduce<SearchItem | null>((a, i) => (!a || i.name.localeCompare(a.name) < 0 ? i : a), null));
  const loaded = !d.isLoading && !!activeId;
  useEffect(() => {
    if (!beside) return;
    useDrinksFirstRow.setState({ item: first, ready: loaded });
    return () => useDrinksFirstRow.setState({ item: null, ready: false });
  }, [beside, first, loaded]);
  const nothing = !d.isLoading && !d.lists[CAPSULE_SHOW[capsule]].length && (capsule !== 'bottles' || !d.lists.garnishes.length);
  const label = [...d.chips.flat(), { value: 'preps', label: 'House-made' }, { value: 'bottles', label: 'Bottles' }].find((f) => f.value === show)?.label ?? 'All';
  const rowOf = (item: SearchItem) => {
    const category = item.category as ItemCategory;
    const facts = show === 'bottles' ? bottles.row(item) : { line: d.lineOf(item), tag: category === 'Ingredient' ? null : d.tagOf(item) };
    return { itemId: item.id, name: item.name, ingredient: category === 'Ingredient', onPressIn: category === 'Cocktail' ? () => prefetch(item.id, { name: item.name, item_images: item.item_images }) : undefined, ...facts };
  };
  const chip = (f: { value: typeof show; label: string }) => <Chip key={f.value} label={f.label} count={String(d.count(f.value))} selected={show === f.value} onPress={() => d.pick(f.value)} />;
  const which = (title: string, all: string, picks: readonly { id: string; name: string; itemIds: string[] }[]) => (
    <FilterRow label={title} gutter={gutter} groups={[[<Chip key="all" label={all} selected={!picks.some((m) => m.id === params.menu)} onPress={() => setView({ menu: undefined })} />, ...picks.map((m) => <Chip key={m.id} label={m.name} count={m.itemIds.length} selected={params.menu === m.id} onPress={() => setView({ menu: m.id })} />)]]} />
  );

  // Not on the board: under the list, so the menu on now and the drinks come first; Classics (the staff list, which has no foot) keeps it on top.
  const nudge = active && canEdit && capsule === 'drinks' ? <MatchClassicsNudge barId={active.id} /> : null;
  const header = (
    <View style={styles.header}>
      <WebHead>
        <title>Drinks</title>
      </WebHead>
      <DrinksHead eyebrow={active?.name ?? ' '} capsules={d.capsules} value={capsule} onChange={d.pickCapsule} offline={offline ? 'Whole spec book on this phone' : null} bleed={panes ? space.xl : gutter} />
      {!phone && !staffView ? <SearchField query={find} onQuery={setFind} placeholder="Search your drinks" /> : null}
      {activeId ? (<><ResumeCard barId={activeId} /><DrinksSetup barId={activeId} /></>) : null}
      <FirstRoundCard />
      {staffView ? nudge : null}
      {capsule === 'drinks' && show === 'all' && d.card ? <OnNowCard {...d.card} onPress={() => router.push(`/menus/${d.card!.id}` as never)} /> : null}
      {nothing ? null : capsule === 'drinks' ? (
        <FilterRow label="Show" gutter={gutter} whole={breakpoint === 'desktop'} groups={d.chips.map((g) => g.map(chip))} />
      ) : capsule === 'bottles' ? (
        <BottleChips bottles={d.lists.bottles} kind={params.kind} low={bottles.low} others={d.chips.flat().filter((f) => f.value !== 'bottles')} show={show} count={d.count} gutter={gutter} whole={breakpoint === 'desktop'} onKind={(kind) => setView({ show: 'bottles', kind, menu: undefined })} onShow={d.pick} />
      ) : null}
      {show === 'on-menu' && d.byMenu.onMenus.length > 1 ? which('Which menu', 'Every menu on now', d.byMenu.onMenus) : null}
      {show === 'on-menu' && !d.byMenu.onMenus.length && d.menus ? <Caption tone="muted">No menu is on right now. Menus are built and scheduled in Menus.</Caption> : null}
      {show === 'rnd' && d.byMenu.rndMenus.length > 1 ? which('Which collection', 'Every R&D drink', d.byMenu.rndMenus) : null}
      {show === 'rnd' ? <Caption tone="muted">Trials, flights and assignments: drinks on an R&D collection and on no menu. They stay out of All and out of staff search.</Caption> : null}
      {capsule === 'house' && activeId ? <HouseMadeTop barId={activeId} nameOf={(id) => d.lists.preps.find((p) => p.id === id)?.name ?? null} /> : null}
      {show === 'preps' && d.prepKinds.length ? (
        <FilterRow label="Which house-made" gutter={gutter} groups={[[<Chip key="all" label="All" count={d.lists.preps.length} selected={!d.kind} onPress={() => setView({ kind: undefined })} />, ...d.prepKinds.map((g) => <Chip key={g.value} label={g.label} count={g.count} selected={d.kind?.value === g.value} onPress={() => setView({ kind: g.value })} />)]]} />
      ) : null}
      {!staffView && shown.length ? <SectionLabel title={`${q ? `${shown.length} of` : label} ${inView.length}`} aside="A to Z" /> : null}
    </View>
  );

  const found = find.trim();
  // Did you mean (whole-app canvas, Search page): nothing here asks about the closest name, here or everywhere; "No" adds it here.
  const ask = <NearResults query={found} found={0} shown={NO_IDS} yours={inView} yoursCaption="Here" classics={classicList} server={EVERYWHERE} title={`Nothing here called “${found}”`} miss={<Caption tone="muted">{`Nothing here called “${found}”.`}</Caption>} add={canEdit ? { label: `add ${capitalize(found)}`, onPress: () => router.push(newDrinkHref(capitalize(found), activeId) as never) } : undefined} />;
  const failed = !!d.error && !d.published.length;
  const empty = failed ? (
    <PencilState kind="error" title="Drinks didn’t load" detail="The connection dropped halfway." action={{ label: 'Try again', onPress: () => void client.refetchQueries({ type: 'active' }) }} />
  ) : d.isLoading ? (
    <DrinksLoading />
  ) : q ? (
    ask
  ) : (
    <DrinksEmpty barId={activeId} capsule={capsule} nothing={nothing} canAdd={canEdit} onSnapBottles={() => setSnapping(true)} />
  );
  // Past the list: Bottles' order and its own tools, the one search everywhere with what was typed, and offline, that search still works.
  const foot = (
    <View style={styles.foot}>
      {capsule === 'bottles' && activeId && !nothing ? <ToOrder barId={activeId} /> : null}
      {nudge && !staffView ? <View style={styles.wide}>{nudge}</View> : null}
      {show === 'bottles' && activeId && canEdit ? (
        <View style={styles.actions}>
          <Button label="Snap a bottle" icon="camera.fill" variant="secondary" onPress={() => setSnapping(true)} />
          <Button label="Swap a bottle" variant="secondary" onPress={() => setSwap(true)} />
        </View>
      ) : null}
      {q && shown.length ? <NearResults query={found} found={shown.length} shown={shownIds} yours={inView} yoursCaption="Here" title="" miss={null} /> : null}
      {q ? <Button label={`Search everywhere for “${found}”`} icon="magnifyingglass" variant="secondary" onPress={() => openSearch({ query: found, scope: 'everywhere' })} /> : null}
      {offline && shown.length ? <Caption tone="muted">Search works offline too.</Caption> : null}
    </View>
  );
  const listBottom = { paddingHorizontal: gutter, paddingBottom: bottom };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {panes && !staffView ? (
        <DrinksPanes items={shown} rowOf={rowOf} header={header} empty={empty} footer={foot} routed={beside} />
      ) : staffView && activeId ? (
        // The staff list drags to reorder, so it is the scroll view itself.
        <Suspense fallback={<FlatList data={[]} renderItem={() => null} ListHeaderComponent={header} contentContainerStyle={listBottom} />}>
          <StaffList barId={activeId} canEdit={canOrder} onNow={d.onNow} past={d.past} header={header} contentContainerStyle={listBottom} />
        </Suspense>
      ) : (
        <FlatList
          data={shown}
          // A screen's worth first: the defaults drew every drink on open, which froze iOS for seconds.
          initialNumToRender={10}
          windowSize={DRAWN_LIST_WINDOW}
          keyExtractor={(i) => i.id}
          contentContainerStyle={[listBottom, styles.list]}
          ListHeaderComponent={header}
          renderItem={({ item }) => <DrinkListRow {...rowOf(item)} onPress={() => router.push(itemHref(item.category as ItemCategory, item.id) as never)} />}
          ListEmptyComponent={empty}
          ListFooterComponent={foot}
        />
      )}
      <RoundOpened />
      {swap && activeId ? (
        <Suspense fallback={null}>
          <SwapSheet barId={activeId} onClose={() => setSwap(false)} />
        </Suspense>
      ) : null}
      {active ? <BottlePhotoSheet visible={snapping} target={{ kind: 'venue', barId: active.id, name: active.name, canEdit }} onClose={() => setSnapping(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { gap: space.md, paddingBottom: space.sm },
  list: { gap: space.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  foot: { paddingTop: space.md, gap: space.md, alignItems: 'flex-start' },
  wide: { alignSelf: 'stretch' },
});
