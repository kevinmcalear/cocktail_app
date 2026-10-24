import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Headline } from '@/components/ds';
import { MenuGroupList } from '@/components/screens/menus/MenuGroupList';
import { NewMenuSheet } from '@/components/screens/menus/NewMenuSheet';
import { space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useVenueMenus } from '@/hooks/useMenus';
import { shelfReady } from '@/lib/collectionMenus';
import type { AwayGroup } from '@/lib/toMake';
import type { MenuSummary } from '@/types/menus';

export interface Shelf {
  canMakeIds: Set<string>;
  oneAway: readonly AwayGroup[];
}

/** "3 you can make · Need Cynar": what your shelf makes, and the bottle that gets you closer. Nothing when it's neither. */
function shelfNote(menu: MenuSummary, shelf: Shelf): string | undefined {
  const r = shelfReady(menu.itemIds, shelf.canMakeIds, shelf.oneAway);
  return [r.ready ? `${r.ready} you can make` : null, r.shop].filter(Boolean).join(' · ') || undefined;
}

/**
 * Your own menus (no venue) on Collection's Menus, in the same groups as the
 * Menus screen (menus-one-look): the next one as a card, the rest as rows,
 * past nights as lines, each saying how much of it your shelf makes. On a
 * desktop (`wide`) New menu moves to the page header (`creating` is lifted
 * for that).
 */
export function CollectionMenus({ shelf, wide, creating, setCreating }: { shelf: Shelf; wide: boolean; creating: boolean; setCreating: (on: boolean) => void }) {
  const userId = useUserId();
  const { data = [], isLoading } = useVenueMenus(null);
  const [now] = useState(() => Date.now());
  const mine = data.filter((m) => m.barId === null && m.createdBy === userId);
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Headline role="heading">Your menus</Headline>
          <Caption tone="muted">For nights in</Caption>
        </View>
        {wide ? null : <Button label="New menu" icon="plus" variant="secondary" onPress={() => setCreating(true)} />}
      </View>
      {!isLoading && !mine.length ? <Body tone="muted">Plan a night in: pick the drinks, then share the menu with your guests.</Body> : null}
      <MenuGroupList menus={mine} now={now} canBuild note={(m) => shelfNote(m, shelf)} />
      {creating ? <NewMenuSheet visible onClose={() => setCreating(false)} menus={mine} now={now} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  flex: { flex: 1, minWidth: 0, gap: 2 },
});
