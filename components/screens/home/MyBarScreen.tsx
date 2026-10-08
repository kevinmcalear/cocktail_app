import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Display, useDs, useGutter } from '@/components/ds';
import { ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { space } from '@/constants/tokens';
import { useItemFlavors, useMyTaste } from '@/hooks/useFlavor';
import { useMyBar, usePantryItems, useShelfEdit, type BarItem, type ShelfItem } from '@/hooks/useHomeBar';
import { COLD_START_DRINKS, matchPercent } from '@/lib/flavor';
import { MAKE_PAGE, makeTab, myBarRows, type MakeTab, type MyBarRow } from '@/lib/myBarRows';
import type { ShelfSort } from '@/lib/pantry';

import { BottlePhotoSheet } from '../bottles/BottlePhotoSheet';
import { AddBottlesSheet } from './AddBottlesSheet';
import { PantrySection } from './PantrySection';
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
  const [adding, setAdding] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [sort, setSort] = useState<ShelfSort>('newest');
  const [query, setQuery] = useState('');
  const [shelfOpen, setShelfOpen] = useState(false);
  const [picked, setPicked] = useState<MakeTab | null>(null);
  const [shown, setShown] = useState(MAKE_PAGE);
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(new Set());

  // Staples live on the shelf too, but are listed under Fridge & pantry, not as bottles.
  const staples = new Set((pantry.data ?? []).map((p) => p.id));
  const bottles = bar.shelf.filter((b) => !staples.has(b.id));
  const empty = !bar.isLoading && bottles.length === 0;

  const { data: me } = useMyTaste();
  // Match percentages only once your taste comes from enough rankings.
  const scored = me && me.basis === 'ranked' && me.rankedDrinks >= COLD_START_DRINKS ? me.taste : null;
  const profiles = useItemFlavors([...bar.canMake, ...[...bar.oneAway, ...bar.twoAway].flatMap((g) => g.drinks)].map((d) => d.id), !!scored);
  const matchFor = (id: string) => {
    const profile = scored && profiles.data?.[id];
    return profile ? `${matchPercent(scored, profile)}% match` : undefined;
  };

  const tab = makeTab(picked, bar);
  const pick = (t: MakeTab) => {
    setPicked(t);
    setShown(MAKE_PAGE);
  };
  const rows = myBarRows<ShelfItem, BarItem, AwayGroup>({
    bottles,
    sort,
    query,
    shelfOpen,
    make: bar.shelfIds.size ? { canMake: bar.canMake, oneAway: bar.oneAway, twoAway: bar.twoAway, tab, shown } : null,
  });

  const renderRow = ({ item, index }: { item: Row; index: number }) => {
    switch (item.kind) {
      case 'top':
        return (
          <View>
            <ScreenHeaderSpacer />
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
                <Button label={empty ? 'Add your bottles' : 'Add bottles'} icon="plus" variant={empty ? 'primary' : 'secondary'} onPress={() => setAdding(true)} style={styles.grow} />
                <Button label="Snap" accessibilityLabel="Snap a bottle" icon="camera.fill" variant="secondary" onPress={() => setSnapping(true)} />
              </View>
            </View>
          </View>
        );
      case 'shelf-head':
        return (
          <View style={styles.section}>
            <ShelfHead count={bottles.length} sort={sort} onSort={setSort} query={query} onQuery={setQuery} />
          </View>
        );
      case 'bottle':
        return <BottleRow item={item.bottle} heading={item.heading} onRemove={(b) => remove.mutate(b.id)} />;
      case 'shelf-foot':
        return <ShelfFoot found={item.found} sort={sort} query={query} open={shelfOpen} onOpen={setShelfOpen} />;
      case 'pantry':
        return <PantrySection items={pantry.data ?? []} onShelf={bar.shelfIds} onAdd={(ids) => add.mutate(ids)} onRemove={(id) => remove.mutate(id)} style={styles.section} />;
      case 'make-head':
        return (
          <View style={styles.section}>
            <MakeHead tab={tab} onTab={pick} counts={{ ready: bar.canMake.length, one: bar.oneAway.length, two: bar.twoAway.length }} />
          </View>
        );
      case 'drink':
        return <MakeDrink drink={item.drink} matchFor={matchFor} />;
      case 'group':
        return (
          <BottleGroup
            group={item.group}
            open={openGroups.has(item.key)}
            onOpen={() => setOpenGroups(new Set(openGroups).add(item.key))}
            matchFor={matchFor}
            onAdd={(ids) => add.mutate(ids)}
            style={rows[index - 1]?.kind === 'group' ? styles.nextGroup : null}
          />
        );
      case 'make-empty':
        return <MakeEmpty tab={tab} oneAway={bar.oneAway.length} />;
      case 'make-foot':
        return <MakeFoot more={item.more} onMore={() => setShown(shown + MAKE_PAGE)} />;
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={renderRow}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom, maxWidth: 760, width: '100%' }}
      />
      <AddBottlesSheet
        visible={adding}
        onShelf={bar.shelfIds}
        onToggle={(item, on) => (on ? add.mutate(item.id) : remove.mutate(item.id))}
        onClose={() => setAdding(false)}
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
});
