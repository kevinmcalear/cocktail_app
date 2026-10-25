import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, DsText, Switch, TextLink } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useShoppingEdit, useShoppingList } from '@/hooks/useShoppingList';

/**
 * The bottle sheet's shopping part (shopping In 1): Running low puts the
 * bottle on the list and leaves it on the shelf; Finished it asks whether to
 * buy it again.
 */
export function BottleShopping({ item, onFinish, onPage }: { item: { id: string; name: string }; onFinish: (id: string) => void; onPage: () => void }) {
  const router = useRouter();
  const rows = useShoppingList().data ?? [];
  const edit = useShoppingEdit();
  const low = rows.find((r) => r.itemId === item.id && r.source === 'running_low' && !r.gotAt);
  const listed = rows.some((r) => r.itemId === item.id && !r.gotAt);
  const setLow = (on: boolean) => {
    if (on) edit.add.mutate([{ itemId: item.id, name: item.name, source: 'running_low' }]);
    else if (low) edit.remove.mutate(low.id);
  };
  const openList = () => {
    onPage();
    router.push('/shopping' as Href);
  };
  return (
    <>
      <View style={styles.block}>
        <View style={styles.row}>
          <View style={styles.grow}>
            <DsText variant="body">Running low</DsText>
            {low ? <Caption tone="muted">On your shopping list</Caption> : null}
          </View>
          {low ? <TextLink label="Open" onPress={openList} /> : null}
          <Switch value={!!low} onValueChange={setLow} label={`${item.name} is running low`} />
        </View>
        <Caption tone="muted">It stays on your shelf and still counts for drinks. When you tick it off the list, Running low turns off.</Caption>
      </View>
      <View style={styles.block}>
        <Body>{`Finished the ${item.name}?`}</Body>
        <Caption tone="muted">It comes off your shelf.</Caption>
        {listed && !low ? null : (
          <Button
            label="Take it off and buy again"
            onPress={() => {
              // A running-low row becomes one to buy again: it's no longer on the shelf.
              if (low) edit.retag.mutate({ id: low.id, source: 'again' });
              else edit.add.mutate([{ itemId: item.id, name: item.name, source: 'again' }]);
              onFinish(item.id);
            }}
          />
        )}
        <Button
          label="Just take it off"
          variant="secondary"
          onPress={() => {
            if (low) edit.remove.mutate(low.id);
            onFinish(item.id);
          }}
        />
        <Caption tone="muted">Either way it goes to Bought before, one tap from the list.</Caption>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  grow: { flex: 1, minWidth: 0 },
});
