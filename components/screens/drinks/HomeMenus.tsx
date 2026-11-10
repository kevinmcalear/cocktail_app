import { useState, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, useBreakpoint } from '@/components/ds';
import { BarMenusForYou } from '@/components/screens/home/BarMenusForYou';
import { CollectionMenus } from '@/components/screens/home/CollectionMenus';
import { CollectionReleases } from '@/components/screens/home/CollectionReleases';
import { CollectionSavedMenus } from '@/components/screens/home/CollectionSavedMenus';
import { MyBarScreen as Shelf } from '@/components/screens/home/MyBarScreen';
import { TechniquesGate } from '@/components/techniques/TechniquesGate';
import { layout, space } from '@/constants/tokens';
import { useMyBar } from '@/hooks/useHomeBar';

// One lazy chunk for the shelf and the menus: the two share their data hooks, so apart each would carry its own copy on the web.
/** My Bar, once the technique library is in (its kit, projects and what to make read it; lib/techniques). */
export function MyBarScreen(props: ComponentProps<typeof Shelf>) {
  return (
    <TechniquesGate>
      <Shelf {...props} />
    </TechniquesGate>
  );
}
/**
 * Home Drinks' Menus (Prod-phone drinks, home; boards home-collection-menus
 * and -desktop-menus): the menus you build for nights in, in the Menus
 * screen's groups, bar menus you saved, releases, then bar menus picked for
 * you. Your own keep to the text column on a desktop, with New menu at the
 * top; Bar menus for you runs wide.
 */
export function HomeMenus() {
  const desk = useBreakpoint() === 'desktop';
  const bar = useMyBar();
  const [creating, setCreating] = useState(false);
  return (
    <View style={styles.menus}>
      <View style={[styles.menus, desk && styles.text]}>
        {desk ? <Button label="New menu" icon="plus" variant="secondary" onPress={() => setCreating(true)} style={styles.new} /> : null}
        <CollectionMenus shelf={bar} wide={desk} creating={creating} setCreating={setCreating} />
        <CollectionSavedMenus canMakeIds={bar.canMakeIds} />
        <CollectionReleases canMakeIds={bar.canMakeIds} />
      </View>
      <BarMenusForYou wide={desk} />
    </View>
  );
}

const styles = StyleSheet.create({
  menus: { gap: space.xxl },
  text: { maxWidth: layout.page.text },
  new: { alignSelf: 'flex-start' },
});
