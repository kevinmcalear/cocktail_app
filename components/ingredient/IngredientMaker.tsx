import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, PressableScale, useDs } from '@/components/ds';
import { MakerPicker } from '@/components/maker/MakerPicker';
import { layout, space } from '@/constants/tokens';
import { useItemMaker, useSetItemMaker } from '@/hooks/useMakers';
import { useCanEditItem } from '@/hooks/useViewAs';

/**
 * "Made by" on a bottle's page: its maker's page, and for whoever can edit the
 * bottle, a way to set or change it.
 */
export function IngredientMaker({ item }: { item: { id: string; bar_id: string | null } }) {
  const ds = useDs();
  const router = useRouter();
  const { data: maker } = useItemMaker(item.id);
  const canEdit = useCanEditItem(item);
  const save = useSetItemMaker(item.id);
  const [picking, setPicking] = useState(false);

  if (!maker && !canEdit) return null;
  return (
    <View style={styles.stack}>
      {maker ? (
        <PressableScale
          role="link"
          accessibilityLabel={`Made by ${maker.display_name}, open`}
          onPress={() => router.push(`/p/${maker.handle}` as Href)}
          style={[styles.row, { borderTopColor: ds.c.line }]}
        >
          <Caption tone="muted">Made by</Caption>
          <Body numberOfLines={1} style={styles.name}>
            {maker.display_name}
          </Body>
        </PressableScale>
      ) : null}
      {canEdit && !picking ? (
        <View style={styles.actions}>
          <Button label={maker ? 'Change maker' : 'Add its maker'} variant="ghost" onPress={() => setPicking(true)} />
          {maker ? <Button label="Remove" variant="ghost" disabled={save.isPending} onPress={() => save.mutate(null)} /> : null}
        </View>
      ) : null}
      {canEdit && picking ? (
        <View style={styles.stack}>
          <MakerPicker
            label="Who makes it?"
            onPick={(m) => {
              save.mutate(m.id);
              setPicking(false);
            }}
          />
          <Button label="Cancel" variant="ghost" onPress={() => setPicking(false)} style={styles.start} />
        </View>
      ) : null}
      {save.error ? (
        <Caption tone="accent" role="alert">
          Couldn’t save the maker. Check your connection and try again.
        </Caption>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget, borderTopWidth: StyleSheet.hairlineWidth },
  name: { flex: 1 },
  actions: { flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' },
  start: { alignSelf: 'flex-start' },
});
