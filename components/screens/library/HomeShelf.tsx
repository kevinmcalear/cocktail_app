import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button } from '@/components/ds';
import { useTileCols } from '@/components/screens/home/BarTile';
import { BottleTiles } from '@/components/screens/home/ShelfSection';
import { TonightLabel } from '@/components/screens/tonight/TonightParts';
import { space } from '@/constants/tokens';
import { useMyBar } from '@/hooks/useHomeBar';

const NOTHING = () => {};

/** Your shelf at a glance (Prod-drinks, Home · Shelf): the bottles by kind, then what you make at home. The whole shelf, with adding and editing, is My Bar. */
export function HomeShelf() {
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


const styles = StyleSheet.create({
  shelf: { gap: space.lg },
  open: { alignItems: 'flex-start' },
});
