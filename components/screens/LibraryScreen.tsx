import { useRouter } from 'expo-router';
import { lazy, Suspense, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Button, Caption, Chip, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { useWebNav } from '@/hooks/useIsWideWeb';
import { BottlePhotoSheet } from '@/components/screens/bottles/BottlePhotoSheet';
import { MatchClassicsNudge } from '@/components/screens/classics/MatchClassicsNudge';
import { ResumeCard } from '@/components/screens/bringin/ResumeCard';
import { LibrarySetup } from '@/components/screens/venueSetup/SetupBanner';
import { FirstRoundCard, RoundOpened } from '@/components/screens/firstRound/FirstRoundCard';
import { FilterRow } from '@/components/screens/library/LibraryChips';
import { useTileLines } from '@/components/screens/library/useTileLines';
import { LibraryHead, SEGMENT_HOME, segmentOf } from '@/components/screens/library/LibraryHead';
import { LibraryViewButton, SEGMENT_VIEWS } from '@/components/screens/library/LibraryViewButton';
import { OnNowCard } from '@/components/screens/library/OnNowCard';
import { TonightLabel } from '@/components/screens/tonight/TonightParts';
import { LibraryEmpty } from '@/components/screens/library/LibraryEmpty';
import { LibraryPanes } from '@/components/screens/library/LibraryPanes';
import { useLibraryView } from '@/components/screens/library/useLibraryView';
import { NearResults } from '@/components/search/NearResults';
import { SearchField } from '@/components/search/SearchField';
import { SwapSheet } from '@/components/screens/library/SwapSheet';
import { space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';
import { useOpenSearch } from '@/hooks/useSearchFrom';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useDrinkLists } from '@/hooks/useDiscover';
import { useKitShelves } from '@/hooks/useKitCheck';
import { useVenueMenus } from '@/hooks/useMenus';
import { usePricedItemIds } from '@/hooks/usePricing';
import { useSearchCatalog } from '@/hooks/useSearchCatalog';
import { venueContextIds } from '@/lib/barContextFilter';
import { newDrinkHref, type ItemCategory } from '@/lib/itemRoutes';
import { groupMenus, menuDateLine } from '@/lib/menus';
import { capitalize } from '@/lib/stringUtils';
import { matchesQuery } from '@/lib/publicDrinks';
import { BATCHED_STYLES, DRINK_CATEGORIES, filterGroups, itemIdOf, menuDrinks, parseShow, PREP_GROUPS, TYPE_FILTERS, type Show } from '@/lib/libraryFilters';
import { usePrepFacts, useVenueShelves } from '@/hooks/useVenueShelves';

// The staff list drags to reorder, with gesture and animation code the rest of the
// Library doesn't need: it loads when Classics is picked.
const StaffList = lazy(() => import('@/components/screens/library/StaffList').then((m) => ({ default: m.StaffList })));

const NO_IDS: string[] = [];
const EVERYWHERE = { area: { kind: 'anywhere' }, kinds: ['drink', 'bar', 'person', 'ingredient'] } as const;

/**
 * Drinks at a venue: the venue's spec book (board Prod-drinks). The bar's name
 * over "Drinks", a Drinks / House-made / Bottles switch, the menu on now as a
 * card, then the list as rows ("All 48 · A to Z"), each with its drawing and
 * how it's made. Under the switch a row of views (On menu, Classics, Old
 * drinks, R&D, Batched, Beer, Wine, the kit check) narrows the list; House-made
 * has its kinds, Bottles its Ingredients and Needs a price. The view lives in
 * the URL (?show=staff&menu=<id>), so a link opens the same view. Classics is
 * the staff list, ranked, with cut lines. Without a venue, each type on its own.
 * `beside`: the list in its column beside the Drinks stack on a desktop
 * (components/nav/DrinksSplit.tsx), where a drink opens at its own URL.
 */
export function LibraryScreen({ beside = false }: { beside?: boolean }) {
  const ds = useDs();
  const router = useRouter();
  // The palette on wide screens, the search tab on phones (q01).
  const openSearch = useOpenSearch();
  const gutter = useGutter();
  const breakpoint = useBreakpoint();
  const bottom = useTabBarInset();
  // A tablet beside the rail: the list and the picked drink side by side. A desktop: the list, with the drink beside it.
  const nav = useWebNav();
  const panes = beside || nav === 'rail';
  // The venue in the header, not the old sidebar's multi-select contexts.
  const { active, isLoading: venuesLoading } = useActiveVenue();
  const activeId = active?.id ?? null;
  const { view: params, setView } = useLibraryView(beside);
  const show = parseShow(params.show, !!activeId || venuesLoading);
  const contextIds = useMemo(() => venueContextIds(activeId, venuesLoading), [activeId, venuesLoading]);
  const { items, isLoading } = useSearchCatalog(contextIds);
  const { data: capabilities, isLoading: capsLoading } = useCapabilities(activeId);
  const canCost = !!capabilities?.includes('costs');
  const canEdit = !!capabilities?.includes('edit_drinks');
  const canOrder = !!capabilities?.includes('menus');
  const [swap, setSwap] = useState(false);
  const [snapping, setSnapping] = useState(false);
  // Wide screens keep Find in Library in the header, narrowing the list in place; a phone's search circle opens on the venue.
  const phone = breakpoint === 'phone';
  const [find, setFind] = useState('');
  const q = phone ? '' : find.trim().toLowerCase();
  const { data: pricedIds } = usePricedItemIds(activeId, canCost);
  const { data: menus } = useVenueMenus(activeId);
  const [now] = useState(() => Date.now());

  const published = useMemo(() => items.filter((i) => !i.isDraft), [items]);
  const shelves = useVenueShelves(activeId, published);
  const prepFacts = usePrepFacts(shelves.preps);
  const kit = useKitShelves(activeId, published);
  const here = useMemo(() => (menus ?? []).filter((m) => m.barId === activeId), [menus, activeId]);
  const byMenu = useMemo(() => menuDrinks(here, now, params.menu ?? null), [here, now, params.menu]);
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
      ready: kit.ready.filter((i) => !rnd.has(itemIdOf(i.id))),
      needs: kit.needs.filter((i) => !rnd.has(itemIdOf(i.id))),
    };
    // Cocktails are All's cocktails: R&D trials stay out here too.
    for (const f of TYPE_FILTERS) out[f.value] = published.filter((i) => i.category === f.category && !rnd.has(itemIdOf(i.id)));
    return out;
  }, [published, pricedIds, canCost, byMenu, shelves, kit]);
  const onNow = useMemo(() => new Set(byMenu.onNow), [byMenu]);
  const past = useMemo(() => new Set(byMenu.past), [byMenu]);
  // Preps by what was done to them (Syrups, Cordials...): the groups this venue has.
  const prepKinds = PREP_GROUPS.map((g) => ({ ...g, count: lists.preps.filter((p) => prepFacts[p.id]?.group === g.group).length })).filter((g) => g.count);
  const kind = show === 'preps' ? prepKinds.find((g) => g.value === params.kind) : undefined;
  const inView = lists[show].filter((i) => !kind || prepFacts[i.id]?.group === kind.group);
  const shown = inView.filter((i) => !q || matchesQuery(i, q)).sort((a, b) => a.name.localeCompare(b.name));
  const shownIds = useMemo(() => shown.map((i) => i.id), [shown]);
  const { data: classicList } = useDrinkLists(!!q);
  const { lineOf } = useTileLines({ show, rndMenus: byMenu.rndMenus, prepLine: (id) => prepFacts[id]?.line ?? null, needsOf: kit.needsOf });
  const groups = filterGroups(!!activeId, canCost);
  const pick = (value: Show) => setView({ show: value, menu: undefined, kind: undefined });
  const staffView = show === 'staff' && !!activeId;
  const segment = activeId ? segmentOf(show) : null;
  // The views behind the header's button: this segment's own, those the venue has (the picked one always shows).
  const count = (value: Show) => (value === 'staff' ? null : lists[value].length);
  const views = (segment ? groups.flat().filter((f) => SEGMENT_VIEWS[segment].includes(f.value)) : groups.flat()).filter((f) => f.value === show || f.value === 'all' || f.value === 'staff' || (count(f.value) ?? 1) > 0);
  // The menu on now, and the next one up.
  const grouped = groupMenus(here, now);
  const current = grouped.on[0];
  const next = grouped.upcoming[0];
  const plainName = (n: string) => n.replace(/ menu$/i, '');
  const nextLine = next?.startsAt ? `${plainName(next.name)} on ${new Date(next.startsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : null;
  const listBottom = bottom;
  const label = groups.flat().find((f) => f.value === show)?.label ?? 'All';
  const header = (
    <View style={styles.header}>
      <LibraryHead
        gutter={gutter}
        eyebrow={active?.name ?? ''}
        segment={segment}
        onSegment={(s) => pick(SEGMENT_HOME[s])}
        find={phone || staffView ? undefined : <SearchField query={find} onQuery={setFind} placeholder="Find in Library" />}
        filter={<LibraryViewButton views={views} show={show} count={count} onPick={pick} />}
      />
      {show === 'all' && current && !q ? (
        <OnNowCard
          name={plainName(current.name)}
          since={menuDateLine(current, now, undefined, true)}
          line={[`${new Set(current.itemIds).size} drinks`, nextLine].filter(Boolean).join(' · ')}
          ids={[...new Set(current.itemIds)]}
          onPress={() => router.push(`/menus/${current.id}` as never)}
        />
      ) : null}
      {activeId ? (<><ResumeCard barId={activeId} /><LibrarySetup barId={activeId} /></>) : null}
      <FirstRoundCard />
      {show === 'on-menu' && byMenu.onMenus.length > 1 ? (
        <FilterRow
          label="Which menu"
          gutter={gutter}
          groups={[[
            <Chip look="outline" key="all" label="Every menu on now" selected={!byMenu.onMenus.some((m) => m.id === params.menu)} onPress={() => setView({ menu: undefined })} />,
            ...byMenu.onMenus.map((m) => <Chip look="outline" key={m.id} label={m.name} count={m.itemIds.length} selected={params.menu === m.id} onPress={() => setView({ menu: m.id })} />),
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
            <Chip look="outline" key="all" label="Every R&D drink" selected={!byMenu.rndMenus.some((m) => m.id === params.menu)} onPress={() => setView({ menu: undefined })} />,
            ...byMenu.rndMenus.map((m) => <Chip look="outline" key={m.id} label={m.name} count={m.itemIds.length} selected={params.menu === m.id} onPress={() => setView({ menu: m.id })} />),
          ]]}
        />
      ) : null}
      {show === 'rnd' ? <Caption tone="muted">Trials, flights and assignments: drinks on an R&D collection and on no menu. They stay out of All and out of staff search.</Caption> : null}
      {show === 'preps' && prepKinds.length ? (
        <FilterRow
          label="Which house-made"
          gutter={gutter}
          groups={[[
            <Chip look="outline" key="all" label="All house-made" count={lists.preps.length} selected={!kind} onPress={() => setView({ kind: undefined })} />,
            ...prepKinds.map((g) => <Chip look="outline" key={g.value} label={g.label} count={g.count} selected={kind?.value === g.value} onPress={() => setView({ kind: g.value })} />),
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
      {staffView ? null : <TonightLabel title={`${label} ${q ? `${shown.length} of ${inView.length}` : inView.length}`} aside="A to Z" />}
    </View>
  );

  const found = find.trim();
  // Did you mean (whole-app canvas, Search page): nothing here asks about the closest name, here or everywhere; "No" adds it here.
  const ask = <NearResults query={found} found={0} shown={NO_IDS} yours={inView} yoursCaption="Here" classics={classicList} server={EVERYWHERE} title={`Nothing here called “${found}”`} miss={<Caption tone="muted">{`Nothing here called “${found}”.`}</Caption>} add={canEdit ? { label: `add ${capitalize(found)}`, onPress: () => router.push(newDrinkHref(capitalize(found), activeId) as never) } : undefined} />;
  const empty = venuesLoading || isLoading ? null : q ? ask : <LibraryEmpty barId={activeId} noDrinks={!published.length} canAdd={canEdit} />;
  // Past this list: the one search, everywhere, with what was typed; the nudge to match classics, last.
  const foot = q || (active && canEdit) ? (
    <View style={styles.foot}>
      {q && shown.length ? <NearResults query={found} found={shown.length} shown={shownIds} yours={inView} yoursCaption="Here" title="" miss={null} /> : null}
      {q ? <Button label={`Search everywhere for “${found}”`} icon="magnifyingglass" variant="secondary" onPress={() => openSearch({ query: found, scope: 'everywhere' })} /> : null}
      {active && canEdit ? <MatchClassicsNudge barId={active.id} /> : null}
    </View>
  ) : null;

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {staffView && activeId ? (
        // The staff list drags to reorder, so it is the scroll view itself.
        <Suspense fallback={<FlatList data={[]} renderItem={() => null} ListHeaderComponent={header} contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: listBottom }} />}>
          <StaffList barId={activeId} canEdit={canOrder} onNow={onNow} past={past} header={header} contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: listBottom }} />
        </Suspense>
      ) : (
        <LibraryPanes venueId={activeId} items={shown} lineOf={lineOf} header={header} empty={empty} footer={foot} routed={beside} plain={!panes} />
      )}
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
  foot: { paddingTop: space.md, alignItems: 'flex-start', gap: space.md },
});
