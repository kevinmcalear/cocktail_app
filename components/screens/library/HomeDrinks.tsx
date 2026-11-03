import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button, Segmented, useBreakpoint, useDs, useGutter } from '@/components/ds';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { useTabBarInset } from '@/components/nav/WebTabBar';
import { BarMenusForYou } from '@/components/screens/home/BarMenusForYou';
import { useTileCols } from '@/components/screens/home/BarTile';
import { CollectionBars } from '@/components/screens/home/CollectionBars';
import { CollectionDrinks } from '@/components/screens/home/CollectionDrinks';
import { CollectionMenus } from '@/components/screens/home/CollectionMenus';
import { CollectionReleases } from '@/components/screens/home/CollectionReleases';
import { CollectionSavedMenus } from '@/components/screens/home/CollectionSavedMenus';
import { BottleTiles } from '@/components/screens/home/ShelfSection';
import { TonightHead, TonightLabel } from '@/components/screens/tonight/TonightParts';
import { layout, space } from '@/constants/tokens';
import { useMyBar } from '@/hooks/useHomeBar';

type Tab = 'drinks' | 'shelf' | 'menus' | 'bars';
const TABS = [
  { value: 'drinks', label: 'Drinks' },
  { value: 'shelf', label: 'Shelf' },
  { value: 'menus', label: 'Menus' },
  { value: 'bars', label: 'Bars' },
] as const;

const NOTHING = () => {};

/** Your shelf at a glance (Prod-drinks, Home · Shelf): the bottles by kind, then what you make at home. The whole shelf, with adding and editing, is My Bar. */
function Shelf() {
  const router = useRouter();
  const bar = useMyBar();
  const cols = useTileCols();
  const all = bar.shelf;
  const bottles = all.filter((i) => i.section === 'bottles');
  const made = all.filter((i) => i.section === 'preps' || i.section === 'lab');
  const line = `${bottles.length} ${bottles.length === 1 ? 'bottle' : 'bottles'} · ${bar.canMake.length} ${bar.canMake.length === 1 ? 'drink' : 'drinks'} you can make tonight`;
  return (
    <View style={styles.shelf}>
      <Body tone="muted">{line}</Body>
      {bottles.length ? (
        <View>
          <TonightLabel title="Bottles" />
          <BottleTiles bottles={bottles} heading={null} cols={cols} editing={false} onRemove={NOTHING} onAdd={NOTHING} onHold={NOTHING} />
        </View>
      ) : null}
      {made.length ? (
        <View>
          <TonightLabel title="Made at home" />
          <BottleTiles bottles={made} heading={null} cols={cols} editing={false} onRemove={NOTHING} onAdd={NOTHING} onHold={NOTHING} />
        </View>
      ) : null}
      <View style={styles.open}>
        <Button label={all.length ? 'Open my bar' : 'Start your shelf'} variant="secondary" onPress={() => router.push('/shelf' as never)} />
      </View>
    </View>
  );
}

/**
 * Drinks in home mode (board Prod-drinks, Home): your name for the place over
 * "Drinks", then Drinks / Shelf / Menus. Drinks is what you keep (had out, to
 * make, made); Shelf your bottles; Menus the ones you build for nights in.
 * Bars you want to go to stay a fourth switch until the board says where they live.
 */
export function HomeDrinks() {
  const ds = useDs();
  const gutter = useGutter();
  const [tab, setTab] = useState<Tab>('drinks');
  const desk = useBreakpoint() === 'desktop';
  const bottom = useTabBarInset();
  const bar = useMyBar();
  const [creating, setCreating] = useState(false);
  return (
    <View style={[styles.screen, { backgroundColor: ds.c.ground }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: bottom + space.lg }}>
        <View style={styles.content}>
          <View style={{ marginHorizontal: -gutter, gap: space.md }}>
            <ScreenHeader />
          </View>
          <TonightHead eyebrow="Home" title="Drinks" />
          <View style={desk ? styles.tabs : null}>
            <Segmented variant="ink" stretch options={TABS} value={tab} onChange={setTab} accessibilityLabel="Drinks" />
          </View>
          {tab === 'drinks' ? <View style={desk ? styles.table : null}><CollectionDrinks /></View> : null}
          {tab === 'shelf' ? <View style={desk ? styles.table : null}><Shelf /></View> : null}
          {tab === 'menus' ? (
            <View style={styles.menus}>
              <View style={[styles.menus, desk && styles.text]}>
                {desk ? <Button label="New menu" icon="plus" variant="secondary" onPress={() => setCreating(true)} /> : null}
                <CollectionMenus shelf={bar} wide={desk} creating={creating} setCreating={setCreating} />
                <CollectionSavedMenus canMakeIds={bar.canMakeIds} />
                <CollectionReleases canMakeIds={bar.canMakeIds} />
              </View>
              <BarMenusForYou wide={desk} />
            </View>
          ) : null}
          {tab === 'bars' ? <View style={desk ? styles.table : null}><CollectionBars /></View> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: space.xl },
  tabs: { maxWidth: 440 },
  table: { maxWidth: 960 },
  menus: { gap: space.xxl },
  text: { maxWidth: layout.page.text },
  shelf: { gap: space.lg },
  open: { alignItems: 'flex-start' },
});
