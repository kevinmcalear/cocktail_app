import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, useBreakpoint } from '@/components/ds';
import { BarMenusForYou } from '@/components/screens/home/BarMenusForYou';
import { CollectionMenus } from '@/components/screens/home/CollectionMenus';
import { CollectionReleases } from '@/components/screens/home/CollectionReleases';
import { CollectionSavedMenus } from '@/components/screens/home/CollectionSavedMenus';
import { layout, space } from '@/constants/tokens';
import { useMyBar } from '@/hooks/useHomeBar';

/** Home's Menus: the ones you build for nights in, bar menus you saved, releases, then bar menus picked for you. */
export function HomeMenus() {
  const desk = useBreakpoint() === 'desktop';
  const bar = useMyBar();
  const [creating, setCreating] = useState(false);
  return (
    <View style={styles.menus}>
      <View style={[styles.menus, desk && styles.text]}>
        {desk ? <Button label="New menu" icon="plus" variant="secondary" onPress={() => setCreating(true)} /> : null}
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
});
