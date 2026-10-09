import { useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Display, PalateFlower, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { ScreenHeader, ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { space } from '@/constants/tokens';
import { useItemFlavors, useMyTaste } from '@/hooks/useFlavor';
import { useKit } from '@/hooks/useKit';
import { useMadePreps, useMyBar, usePantryItems, useShelfEdit, type BarItem, type ShelfItem } from '@/hooks/useHomeBar';
import { COLD_START_DRINKS, matchPercent } from '@/lib/flavor';
import { JUMP_ROW, MAKE_PAGE, makeTab, myBarRows, type MakeTab, type MyBarRow } from '@/lib/myBarRows';
import { PANTRY_WATER, type ShelfSort } from '@/lib/pantry';
import { labFromNames, projectsFor } from '@/lib/techniques/projects';

import { BottlePhotoSheet } from '../bottles/BottlePhotoSheet';
import { AddToBarSheet, type AddFilter } from './AddToBarSheet';
import { KitSection, LabSection, MoreSections, PrepsSection, SectionJump, type Jumpable } from './BarSections';
import { MakeFirst } from './MakeFirst';
import { PantrySection } from './PantrySection';
import { Projects } from './Projects';
import { BottleRow, ShelfFoot, ShelfHead } from './ShelfSection';
import { BottleGroup, MakeDrink, MakeEmpty, MakeFoot, MakeHead, type AwayGroup } from './WhatToMake';

type Row = MyBarRow<ShelfItem, BarItem, AwayGroup>;

/**
 * My Bar, in home mode: the bottles on your shelf, what's in your kitchen,
 * and what those make now or with one more bottle. Nothing the shelf isn't
 * close to: the rest of the drinks are in Search. One virtualized list
 * (lib/myBarRows.ts), so a long shelf or hundreds of drinks only mount what's
 * on screen.
 */
export function MyBarScreen() {
  const ds = useDs();
  const gutter = useGutter();
  const bottom = useTabBarInset();
  const bar = useMyBar();
  const pantry = usePantryItems();
  const { add, remove } = useShelfEdit();
  // mutate is stable where the mutation objects aren't, so the rows' props stay equal between renders.
  const addIds = add.mutate;
  const removeId = remove.mutate;
  const [adding, setAdding] = useState<AddFilter | null>(null);
  const { owned, toggle: toggleKit } = useKit();
  const listRef = useRef<FlatList<Row>>(null);
  const wide = useBreakpoint() === 'desktop';
  const [snapping, setSnapping] = useState(false);
  const [sort, setSort] = useState<ShelfSort>('newest');
  const [query, setQuery] = useState('');
  const [shelfOpen, setShelfOpen] = useState(false);
  const [picked, setPicked] = useState<MakeTab | null>(null);
  const [shown, setShown] = useState(MAKE_PAGE);
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(new Set());
  const openGroup = (key: string) => setOpenGroups((open) => new Set(open).add(key));

  // Staples live on the shelf too, but are listed as Fridge & pantry chips; the rest go by section.
  const staples = new Set((pantry.data ?? []).map((p) => p.id));
  const listed = bar.shelf.filter((b) => !staples.has(b.id));
  const bottles = listed.filter((b) => b.section === 'bottles');
  const fridge = listed.filter((b) => b.section === 'fridge');
  const lab = listed.filter((b) => b.section === 'lab');
  const preps = listed.filter((b) => b.section === 'preps');
  const empty = !bar.isLoading && bottles.length === 0;

  const { data: me } = useMyTaste();
  // Match percentages only once your taste comes from enough rankings.
  const scored = me && me.basis === 'ranked' && me.rankedDrinks >= COLD_START_DRINKS ? me.taste : null;
  const profiles = useItemFlavors([...bar.canMake, ...[...bar.oneAway, ...bar.twoAway].flatMap((g) => g.drinks)].map((d) => d.id), !!scored);
  const glyphFor = (id: string) => {
    const profile = profiles.data?.[id];
    return profile ? <PalateFlower values={profile} size={28} rings={false} /> : null;
  };
  // Make first: preps the shelf covers but you haven't made, kept to the ready drinks that need them.
  const made = useMadePreps();
  const toMake = (made.data ?? [])
    .map((p) => {
      const needs = new Set(p.drinks);
      return { id: p.id, name: p.name, drinks: bar.canMake.filter((d) => needs.has(d.id)) };
    })
    .filter((p) => p.drinks.length)
    .sort((a, b) => b.drinks.length - a.drinks.length);
  // Under a ready drink: the prep to make first, else the house prep of yours it uses.
  const notes = new Map<string, string>();
  for (const p of toMake) for (const d of p.drinks) if (!notes.has(d.id)) notes.set(d.id, `Make the ${p.name} first`);
  const prepNames = new Map(preps.map((p) => [p.id, p.name]));
  for (const d of bar.canMake) {
    const mine = d.shelfUses?.find((id) => prepNames.has(id));
    if (mine && !notes.has(d.id)) notes.set(d.id, `With your ${prepNames.get(mine)}`);
  }
  const matchFor = (id: string) => {
    const profile = scored && profiles.data?.[id];
    return [profile ? `${matchPercent(scored, profile)}% match` : null, notes.get(id)].filter(Boolean).join(' · ') || undefined;
  };

  // Projects need kit or a lab shelf to mean anything; until then the tab isn't offered.
  const projects = owned.length || lab.length ? projectsFor(new Set(owned), labFromNames(lab.map((l) => l.name))) : null;
  const gone = (picked === 'projects' && !projects) || (picked === 'first' && !toMake.length);
  const tab = makeTab(gone ? null : picked, bar);
  const pick = (t: MakeTab) => {
    setPicked(t);
    setShown(MAKE_PAGE);
  };
  const rows = myBarRows<ShelfItem, BarItem, AwayGroup>({
    bottles,
    sort,
    query,
    shelfOpen,
    more: { lab: lab.length, preps: preps.length, kit: owned.length },
    make: bar.shelfIds.size ? { canMake: bar.canMake, oneAway: bar.oneAway, twoAway: bar.twoAway, first: toMake.length, projects: projects ? projects.ready.length + projects.away.length : 0, tab, shown } : null,
  });

  // On a desktop-wide window the shelf and What to make sit side by side, each scrolling on its own, under one header.
  const cut = wide ? rows.findIndex((r) => r.kind === 'make-head') : -1;

  const jump = (section: Jumpable) => {
    const index = rows.findIndex((r) => r.key === JUMP_ROW[section]);
    if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true });
  };
  // Water comes with the staples but is never shown, so it isn't counted.
  const fridgeCount = (pantry.data ?? []).filter((p) => p.name !== PANTRY_WATER && bar.shelfIds.has(p.id)).length + fridge.length;
  const counts: [Jumpable, number][] = [
    ['bottles', bottles.length],
    ['fridge', fridgeCount],
    ['lab', lab.length],
    ['preps', preps.length],
    ['kit', owned.length],
  ];

  const renderRow = ({ item, index }: { item: Row; index: number }) => {
    switch (item.kind) {
      case 'top':
        return (
          <View>
            {cut > 0 ? null : <ScreenHeaderSpacer />}
            <View style={styles.top}>
              <View>
                <Display>My Bar</Display>
                <Caption tone="muted">
                  {bar.isLoading
                    ? 'Checking your shelf…'
                    : empty
                      ? 'Add the bottles you have to see what you can make.'
                      : `${bar.canMake.length} ${bar.canMake.length === 1 ? 'drink' : 'drinks'} you can make`}
                </Caption>
              </View>
              {bar.error ? <Body tone="muted">Couldn’t load your bar. Try again in a moment.</Body> : null}
              <View style={styles.actions}>
                <Button label="Add to your bar" icon="plus" variant={empty ? 'primary' : 'secondary'} onPress={() => setAdding('all')} style={styles.grow} />
                <Button label="Snap" accessibilityLabel="Snap a bottle" icon="camera.fill" variant="secondary" onPress={() => setSnapping(true)} />
              </View>
            </View>
          </View>
        );
      case 'jump':
        return <SectionJump counts={counts.filter(([, n]) => n > 0)} onJump={jump} />;
      case 'shelf-head':
        return (
          <View style={styles.section}>
            <ShelfHead count={bottles.length} sort={sort} onSort={setSort} query={query} onQuery={setQuery} />
          </View>
        );
      case 'bottle':
        return <BottleRow item={item.bottle} heading={item.heading} onRemove={removeId} />;
      case 'shelf-foot':
        return <ShelfFoot found={item.found} sort={sort} query={query} open={shelfOpen} onOpen={setShelfOpen} />;
      case 'pantry':
        return <PantrySection items={pantry.data ?? []} extras={fridge} onShelf={bar.shelfIds} onAdd={addIds} onRemove={removeId} onMore={() => setAdding('fridge')} style={styles.section} />;
      case 'lab':
        return <LabSection items={lab} onRemove={removeId} style={styles.section} />;
      case 'preps':
        return <PrepsSection items={preps} onRemove={removeId} style={styles.section} />;
      case 'kit':
        return <KitSection owned={owned} onToggle={toggleKit} onAdd={() => setAdding('kit')} style={styles.section} />;
      case 'folds':
        return <MoreSections empty={item.empty} onOpen={setAdding} style={styles.section} />;
      case 'make-head':
        return (
          <View style={styles.section}>
            <MakeHead tab={tab} onTab={pick} counts={{ ready: bar.canMake.length, first: toMake.length, one: bar.oneAway.length, two: bar.twoAway.length, projects: projects?.ready.length }} />
          </View>
        );
      case 'drink':
        return <MakeDrink drink={item.drink} matchFor={matchFor} glyphFor={glyphFor} />;
      case 'group':
        return (
          <BottleGroup
            id={item.key}
            group={item.group}
            open={openGroups.has(item.key)}
            onOpen={openGroup}
            matchFor={matchFor}
            glyphFor={glyphFor}
            onAdd={addIds}
            style={rows[index - 1]?.kind === 'group' ? styles.nextGroup : null}
          />
        );
      case 'first':
        return <MakeFirst preps={toMake} onMade={addIds} />;
      case 'projects':
        return projects ? <Projects ready={projects.ready} away={projects.away} onKit={toggleKit} onLab={() => setAdding('lab')} /> : null;
      case 'make-empty':
        return <MakeEmpty tab={tab} oneAway={bar.oneAway.length} />;
      case 'make-foot':
        return <MakeFoot more={item.more} onMore={() => setShown(shown + MAKE_PAGE)} />;
    }
  };

  const shelfList = (
    <FlatList
      ref={listRef}
      data={cut > 0 ? rows.slice(0, cut) : rows}
      keyExtractor={(r) => r.key}
      renderItem={renderRow}
      // Two screens either side: a sort or tab change re-renders every mounted row.
      windowSize={5}
      // A section shortcut past what's mounted: get close, then land on it once it renders.
      onScrollToIndexFailed={(info) => {
        listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
        setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: true }), 50);
      }}
      style={cut > 0 ? styles.shelfColumn : null}
      contentContainerStyle={cut > 0 ? { paddingLeft: gutter, paddingRight: space.xl, paddingBottom: bottom } : { paddingHorizontal: gutter, paddingBottom: bottom, maxWidth: 760, width: '100%' }}
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      {cut > 0 ? <ScreenHeader /> : null}
      {cut > 0 ? (
        <View style={styles.columns}>
          {shelfList}
          <FlatList
            data={rows.slice(cut)}
            keyExtractor={(r) => r.key}
            renderItem={({ item, index }) => renderRow({ item, index: index + cut })}
            windowSize={5}
            style={styles.makeColumn}
            contentContainerStyle={{ paddingLeft: space.xl, paddingRight: gutter, paddingBottom: bottom }}
          />
        </View>
      ) : (
        shelfList
      )}
      <AddToBarSheet
        visible={adding !== null}
        filter={adding ?? 'all'}
        onFilter={setAdding}
        onShelf={bar.shelfIds}
        onToggle={(item, on) => (on ? addIds(item.id) : removeId(item.id))}
        onClose={() => setAdding(null)}
      />
      <BottlePhotoSheet visible={snapping} target={{ kind: 'home' }} onClose={() => setSnapping(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { gap: space.xl },
  /** Each section starts this far below the last. */
  section: { paddingTop: space.xl },
  nextGroup: { marginTop: space.md },
  actions: { flexDirection: 'row', gap: space.sm },
  grow: { flex: 1 },
  columns: { flex: 1, flexDirection: 'row' },
  shelfColumn: { flex: 4, maxWidth: 560 },
  makeColumn: { flex: 5, maxWidth: 760 },
});
