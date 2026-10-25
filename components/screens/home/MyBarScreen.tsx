import { useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Body, Caption, dragDismissesKeyboard, Title, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { ScreenHeader, ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { space } from '@/constants/tokens';
import { useAuthIdentity } from '@/ctx/AuthContext';
import type { BarItem, ShelfItem } from '@/hooks/useHomeBar';
import { MAKE_PAGE, makeTab, myBarRows, pairDrinks, pickSection, type DrinkPair, type MakeTab, type MyBarRow, type ShelfSection } from '@/lib/myBarRows';
import { barSubtitle, shelfCountsLine } from '@/lib/myBarText';
import type { ShelfSort } from '@/lib/pantry';

import { BottlePhotoSheet } from '../bottles/BottlePhotoSheet';
import { ShoppingBasket, ShoppingColumn, ToBuyStrip } from '../shopping/ToBuy';
import { AddToBarSheet, type AddFilter } from './AddToBarSheet';
import { useTileCols } from './BarTile';
import { KitSection, LabSection, MoreSections, OpenShelfItem, PrepsSection, SectionChips, type Jumpable } from './BarSections';
import { BottleSheet } from './BottleSheet';
import { MakeFirst, MakeFirstStrip } from './MakeFirst';
import { BottleGroup, MakeCard, MakeDrink, type AwayGroup } from './MakeRows';
import { TABLET_DRINKS, TabletOverview, TextLink } from './MyBarTablet';
import { PantrySection } from './PantrySection';
import { Projects } from './Projects';
import { useSectionCards } from './SectionCards';
import { BottleTiles, ShelfFoot, ShelfHead } from './ShelfSection';
import { StarterShelf } from './StarterShelf';
import { useMyBarData } from './useMyBarData';
import { MakeEmpty, MakeFoot, MakeHead, MakeSearchRow, useMakeSearch } from './WhatToMake';

type Row = MyBarRow<ShelfItem, BarItem, AwayGroup>;
type ListRow = Row | DrinkPair<Row>;

/**
 * My Bar, in home mode: the bottles on your shelf, what's in your kitchen,
 * and what those make now or with one more bottle. Nothing the shelf isn't
 * close to: the rest of the drinks are in Search. One virtualized list
 * (lib/myBarRows.ts), so a long shelf or hundreds of drinks only mount what's
 * on screen. An empty shelf starts with the starter (StarterShelf).
 */
export function MyBarScreen() {
  const ds = useDs();
  const gutter = useGutter();
  const bottom = useTabBarInset();
  const breakpoint = useBreakpoint();
  const wide = breakpoint === 'desktop';
  const window = useWindowDimensions();
  const portrait = window.height > window.width;
  // A desktop's shelf column shares the row with What to make and the shopping list (shopping desk-mybar): three tiles to a row,
  // four once the window is wide enough that the shelf's share (after the sidebar and the list) still gives each tile about 120px.
  const tileCols = useTileCols();
  const cols = wide ? (window.width >= 1760 ? 4 : 3) : tileCols;
  const [adding, setAdding] = useState<AddFilter | null>(null);
  const [snapping, setSnapping] = useState(false);
  const [opened, setOpened] = useState<ShelfItem | null>(null);
  const [sort, setSort] = useState<ShelfSort>('newest');
  const [query, setQuery] = useState('');
  const [shelfOpen, setShelfOpen] = useState(false);
  // One section at a time takes things off on a tap.
  const [editing, setEditing] = useState<Jumpable | null>(null);
  const edit = (section: Jumpable) => (on: boolean) => setEditing(on ? section : null);
  // The section filter: none picked is All.
  const [show, setShow] = useState<ShelfSection[]>([]);
  const [picked, setPicked] = useState<MakeTab | null>(null);
  const [shown, setShown] = useState(MAKE_PAGE);
  const search = useMakeSearch();
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(new Set());
  const openGroup = (key: string) => setOpenGroups((open) => new Set(open).add(key));
  const m = useMyBarData({ query: search.query, projectsOpen: picked === 'projects' });
  const { bar, counts, toMake, projects, addIds, removeId } = m;
  const showing = show.filter((s) => counts[s] > 0);
  // A tablet with no section picked: each section a card, What to make beside them (above, in portrait). mybar-tablet-proposal, option C.
  const overview = breakpoint === 'tablet' && !showing.length && bar.shelfIds.size > 0;
  // Portrait opens on the best few drinks; See all lists the rest.
  const [allMake, setAllMake] = useState(false);
  const brief = overview && portrait && !allMake && !search.query.trim();
  const cards = useSectionCards({ on: overview, bottles: m.bottles, pantry: m.pantry, fridge: m.fridge, lab: m.lab, preps: m.preps, owned: m.owned, shelf: bar.shelf, onShelf: bar.shelfIds, counts, onItem: setOpened, onSection: (s) => setShow([s]), onAddIds: addIds, onToggleKit: m.toggleKit });

  // The starter stays up from an empty shelf until Show me, so the bottles tapped in there don't throw you out of it.
  // Only once every shelf row has its name: a query between loads mustn't read as an empty shelf.
  const auth = useAuthIdentity();
  const empty = !auth.loading && !!auth.userId && !bar.isLoading && !bar.error && bar.shelf.length === bar.shelfIds.size && m.bottles.length === 0;
  const [started, setStarted] = useState(false);
  const [leftStarter, setLeftStarter] = useState(false);
  if (empty && !started) setStarted(true);

  const gone = (picked === 'projects' && !projects) || (picked === 'first' && !toMake.length);
  const tab = makeTab(gone ? null : picked, bar);
  const pick = (t: MakeTab) => {
    setPicked(t);
    setShown(MAKE_PAGE);
  };
  const rows = myBarRows<ShelfItem, BarItem, AwayGroup>({
    bottles: m.bottles,
    sort,
    query,
    shelfOpen,
    editing: editing === 'bottles',
    cols,
    more: { fridge: m.fridgeCount, lab: m.lab.length, preps: m.preps.length, kit: m.owned.length },
    show: showing,
    make: bar.shelfIds.size ? { canMake: bar.canMake, oneAway: bar.oneAway, twoAway: bar.twoAway, first: toMake.length, projects: projects ? projects.ready.length + projects.away.length : 0, tab, shown: brief ? Math.min(shown, TABLET_DRINKS) : shown, query: search.query, shownIn: search.shownIn, shelf: bar.shelf } : null,
  });

  // On a desktop-wide window the shelf and What to make sit side by side, each scrolling on its own, under one header.
  const cut = wide || overview ? rows.findIndex((r) => r.kind === 'make-head') : -1;
  const split = wide && cut > 0;
  // A tablet's panel lists drinks as cards: one to a row down the side, two across in portrait.
  const perRow = overview && !portrait ? 1 : 2;
  const tabTotal = { ready: bar.canMake.length, first: toMake.length, one: bar.oneAway.length, two: bar.twoAway.length, projects: projects ? projects.ready.length + projects.away.length : 0 }[tab];
  const cutShort = brief && rows.some((r) => r.kind === 'make-foot' && r.more > 0);
  // A search lists every match, so neither shows under one.
  const seeAll = !overview || !portrait || search.query.trim() ? null : cutShort ? (
    <TextLink label={`See all ${tabTotal}`} onPress={() => setAllMake(true)} />
  ) : allMake ? (
    <TextLink label="Show fewer" onPress={() => setAllMake(false)} />
  ) : null;

  const renderRow = ({ item, prev }: { item: ListRow; prev?: ListRow }) => {
    switch (item.kind) {
      case 'pair':
        return (
          <View style={styles.pair}>
            {item.rows.map((r) => (r.kind === 'drink' ? <MakeCard key={r.key} drink={r.drink} text={m.text} needs={r.needs} /> : null))}
            {item.rows.length < perRow ? <View style={styles.flex} /> : null}
          </View>
        );
      case 'top':
        return split ? null : (
          <View>
            <ScreenHeaderSpacer title="My Bar" actions={<ShoppingBasket />} />
            <View style={styles.top}>
              <Caption tone="muted">{bar.isLoading ? 'Checking your shelf…' : barSubtitle(bar.canMake.length, toMake.length)}</Caption>
              {bar.error ? <Body tone="muted">Couldn’t load your bar. Try again in a moment.</Body> : null}
            </View>
            <ToBuyStrip />
          </View>
        );
      case 'filters':
        return split ? null : (
          <View style={styles.filters}>
            <SectionChips sections={m.filled} counts={counts} picked={showing} onPick={(s) => setShow(pickSection(showing, s))} multi bleed={gutter} />
          </View>
        );
      case 'shelf-head':
        return (
          <View style={styles.section}>
            <ShelfHead count={m.bottles.length} sort={sort} onSort={setSort} query={query} onQuery={setQuery} editing={editing === 'bottles'} onEdit={edit('bottles')} />
          </View>
        );
      case 'bottles':
        return <BottleTiles bottles={item.bottles} heading={item.heading} add={item.add} cols={cols} editing={editing === 'bottles'} onRemove={removeId} onAdd={() => setAdding('bottles')} onHold={setEditing} />;
      case 'shelf-foot':
        return <ShelfFoot found={item.found} foldable={item.foldable} sort={sort} query={query} open={shelfOpen} onOpen={setShelfOpen} />;
      case 'pantry':
        return <PantrySection items={m.pantry} extras={m.fridge} shelf={bar.shelf} onShelf={bar.shelfIds} cols={cols} editing={editing === 'fridge'} onEdit={edit('fridge')} onAdd={addIds} onRemove={removeId} onMore={() => setAdding('fridge')} style={styles.section} />;
      case 'lab':
        return <LabSection items={m.lab} prepUses={m.prepUses} cols={cols} editing={editing === 'lab'} onEdit={edit('lab')} onAdd={() => setAdding('lab')} onRemove={removeId} style={styles.section} />;
      case 'preps':
        return <PrepsSection items={m.preps} keeps={m.keeps} cols={cols} editing={editing === 'preps'} onEdit={edit('preps')} onAdd={() => setAdding('preps')} onRemove={removeId} style={styles.section} />;
      case 'kit':
        return <KitSection owned={m.owned} opens={m.opens} cols={cols} editing={editing === 'kit'} onEdit={edit('kit')} onToggle={m.toggleKit} onAdd={() => setAdding('kit')} style={styles.section} />;
      case 'folds':
        return <MoreSections empty={item.empty} onOpen={setAdding} style={styles.section} />;
      case 'make-head':
        return (
          <View style={styles.section}>
            <MakeHead tab={tab} onTab={pick} counts={{ ready: bar.canMake.length, first: toMake.length, one: bar.oneAway.length, two: bar.twoAway.length, projects: projects?.ready.length }} bottles={m.bottles.length} search={search} found={item.found} action={seeAll}>
              {wide && tab === 'ready' ? <MakeFirstStrip preps={toMake} /> : null}
            </MakeHead>
          </View>
        );
      case 'drink':
        return <MakeDrink drink={item.drink} text={m.text} ready={!item.needs} needs={item.needs} />;
      case 'group':
        return <BottleGroup id={item.key} group={item.group} open={openGroups.has(item.key)} onOpen={openGroup} text={m.text} onAdd={addIds} style={prev?.kind === 'group' ? styles.nextGroup : null} />;
      case 'first':
        return <MakeFirst preps={toMake} short={m.short} onMade={addIds} onAdd={addIds} />;
      case 'projects':
        return projects ? <Projects ready={projects.ready} away={projects.away} drinks={m.projectDrinks} onKit={m.toggleKit} onLab={() => setAdding('lab')} /> : null;
      case 'make-empty':
        return <MakeEmpty tab={tab} oneAway={bar.oneAway.length} />;
      case 'make-heading':
      case 'make-more':
      case 'make-none':
        return <MakeSearchRow row={item} onMore={search.onMore} />;
      case 'make-foot':
        return <MakeFoot more={item.more} tab={tab} query={item.searching ? search.query : undefined} onMore={() => setShown(shown + MAKE_PAGE)} />;
    }
  };

  const list = (data: ListRow[], style: object | null, padding: object) => (
    <FlatList
      data={data}
      keyExtractor={(r) => r.key}
      renderItem={({ item, index }) => renderRow({ item, prev: data[index - 1] })}
      // Two screens either side: a sort or tab change re-renders every mounted row.
      windowSize={5}
      {...dragDismissesKeyboard}
      style={style}
      contentContainerStyle={padding}
    />
  );

  const sheets = (
    <>
      <AddToBarSheet visible={adding !== null} filter={adding ?? 'all'} onFilter={setAdding} onShelf={bar.shelfIds} counts={counts} onToggle={(it, on) => (on ? addIds(it.id) : removeId(it.id))} onClose={() => setAdding(null)} onSnap={() => setSnapping(true)} />
      <BottleSheet item={opened} shelf={bar.shelf} canMake={bar.canMake} oneAway={bar.oneAway} onAdd={addIds} onFinish={m.finishId} onClose={() => setOpened(null)} />
      <BottlePhotoSheet visible={snapping} target={{ kind: 'home' }} onClose={() => setSnapping(false)} />
    </>
  );

  if (started && !leftStarter) {
    return (
      <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
        <StarterShelf pantry={m.pantry} onShelf={bar.shelfIds} oneAway={bar.oneAway} ready={bar.canMake.length} bottles={m.bottles.length} bottom={bottom} onToggle={(id, on) => (on ? addIds(id) : removeId(id))} onAdd={addIds} onSearch={() => setAdding('bottles')} onSnap={() => setSnapping(true)} onShowMe={() => setLeftStarter(true)} />
        {sheets}
      </View>
    );
  }

  return (
    <OpenShelfItem value={setOpened}>
      <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
        {overview && cut >= 0 ? (
          <TabletOverview
            portrait={portrait}
            counts={counts}
            note={bar.isLoading ? 'Checking your shelf…' : null}
            error={!!bar.error}
            cards={cards}
            // Cut short, See all takes the place of the foot's Show more.
            makeRows={pairDrinks(rows.slice(cut).filter((r) => !(cutShort && r.kind === 'make-foot')), perRow)}
            renderRow={(item, prev) => renderRow({ item, prev })}
            onOpen={(s) => setShow([s])}
            onAdd={setAdding}
            bottom={bottom}
          />
        ) : split ? (
          <>
            {/* The list is a column here (shopping desk-mybar), so no basket. */}
            <ScreenHeader />
            <View style={[styles.deskHead, { paddingHorizontal: gutter }]}>
              <View style={styles.deskTitle}>
                <Title>My Bar</Title>
                <Caption tone="muted">{shelfCountsLine(counts)}</Caption>
              </View>
              <SectionChips sections={m.filled} counts={counts} picked={showing} onPick={(s) => setShow(pickSection(showing, s))} multi />
            </View>
            <View style={styles.columns}>
              {list(rows.slice(0, cut), styles.shelfColumn, { paddingLeft: gutter, paddingRight: space.xl, paddingBottom: bottom })}
              {list(pairDrinks(rows.slice(cut)), styles.makeColumn, { paddingLeft: space.xl, paddingRight: space.xl, paddingBottom: bottom })}
              <ShoppingColumn gutter={gutter} bottom={bottom} />
            </View>
          </>
        ) : (
          list(rows, null, { paddingHorizontal: gutter, paddingBottom: bottom, maxWidth: 760, width: '100%' })
        )}
        {sheets}
      </View>
    </OpenShelfItem>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { gap: 2 },
  /** Clear of the title above. */
  filters: { paddingTop: space.xl },
  /** Each section starts this far below the last. */
  section: { paddingTop: space.xl },
  nextGroup: { marginTop: space.md },
  // The title, then the section chips under it, as the desktop board draws them.
  deskHead: { gap: space.md, paddingBottom: space.md },
  pair: { flexDirection: 'row', gap: space.sm + 2, paddingTop: space.sm + 2 },
  flex: { flex: 1 },
  deskTitle: { gap: 2, flexShrink: 1 },
  columns: { flex: 1, flexDirection: 'row' },
  shelfColumn: { flex: 4, maxWidth: 560 },
  makeColumn: { flex: 5, maxWidth: 760 },
});
