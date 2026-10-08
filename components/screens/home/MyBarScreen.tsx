import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Display, useDs, useGutter } from '@/components/ds';
import { ScreenHeaderSpacer } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { space } from '@/constants/tokens';
import { useItemFlavors, useMyTaste } from '@/hooks/useFlavor';
import { useMyBar, usePantryItems, useShelfEdit } from '@/hooks/useHomeBar';
import { COLD_START_DRINKS, matchPercent } from '@/lib/flavor';

import { BottlePhotoSheet } from '../bottles/BottlePhotoSheet';
import { AddBottlesSheet } from './AddBottlesSheet';
import { PantrySection } from './PantrySection';
import { ShelfSection } from './ShelfSection';
import { WhatToMake } from './WhatToMake';

/**
 * My Bar, in home mode: the bottles on your shelf, what's in your kitchen,
 * and what those make now or with one more bottle. Nothing the shelf isn't
 * close to: the rest of the drinks are in Search.
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

  // Staples live on the shelf too, but are listed under Fridge & pantry, not as bottles.
  const staples = new Set((pantry.data ?? []).map((p) => p.id));
  const bottles = bar.shelf.filter((b) => !staples.has(b.id));
  const empty = !bar.isLoading && bottles.length === 0;

  const { data: me } = useMyTaste();
  // Match percentages only once your taste comes from enough rankings.
  const scored = me && me.basis === 'ranked' && me.rankedDrinks >= COLD_START_DRINKS ? me.taste : null;
  const profiles = useItemFlavors([...bar.canMake, ...bar.oneAway.flatMap((g) => g.drinks)].map((d) => d.id), !!scored);
  const matchFor = (id: string) => {
    const profile = scored && profiles.data?.[id];
    return profile ? `${matchPercent(scored, profile)}% match` : undefined;
  };

  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom, maxWidth: 760, width: '100%' }}>
        <ScreenHeaderSpacer />
        <View style={styles.body}>
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

          {bottles.length ? <ShelfSection bottles={bottles} onRemove={(item) => remove.mutate(item.id)} /> : null}

          <PantrySection items={pantry.data ?? []} onShelf={bar.shelfIds} onAdd={(ids) => add.mutate(ids)} onRemove={(id) => remove.mutate(id)} />

          {bar.shelfIds.size ? <WhatToMake canMake={bar.canMake} oneAway={bar.oneAway} matchFor={matchFor} onAdd={(id) => add.mutate(id)} /> : null}
        </View>
      </ScrollView>
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
  body: { gap: space.xl },
  actions: { flexDirection: 'row', gap: space.sm },
  grow: { flex: 1 },
});
