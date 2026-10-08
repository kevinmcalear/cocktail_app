import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Headline } from '@/components/ds';
import { MenuListRow } from '@/components/screens/menus/MenuRows';
import { NewMenuSheet } from '@/components/screens/menus/NewMenuSheet';
import { space } from '@/constants/tokens';
import { useUserId } from '@/ctx/AuthContext';
import { useVenueMenus } from '@/hooks/useMenus';

const SHOWN = 3;

/**
 * Your own menus (no venue) at the top of Collection, each saying how many of
 * its drinks you can make from your shelf. The full list and the builder are
 * the same screens venues use.
 */
export function CollectionMenus({ canMakeIds }: { canMakeIds: Set<string> }) {
  const router = useRouter();
  const userId = useUserId();
  const { data = [], isLoading } = useVenueMenus(null);
  const [now] = useState(() => Date.now());
  const [creating, setCreating] = useState(false);
  const mine = data.filter((m) => m.barId === null && m.createdBy === userId);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Headline role="heading">Menus</Headline>
        <Button label="New menu" icon="plus" variant="secondary" onPress={() => setCreating(true)} />
      </View>
      {!isLoading && !mine.length ? <Body tone="muted">Plan a night in: pick the drinks, then share the menu with your guests.</Body> : null}
      {mine.slice(0, SHOWN).map((m) => {
        const drinks = new Set(m.itemIds);
        const can = [...drinks].filter((id) => canMakeIds.has(id)).length;
        return <MenuListRow key={m.id} menu={m} now={now} note={drinks.size ? `${can} ready to make` : undefined} />;
      })}
      {mine.length > SHOWN ? (
        <Button label={`All ${mine.length} menus`} variant="ghost" onPress={() => router.push('/menus/all')} style={styles.all} />
      ) : null}
      {creating ? <NewMenuSheet visible onClose={() => setCreating(false)} menus={mine} now={now} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm, paddingTop: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  all: { alignSelf: 'flex-start' },
});
