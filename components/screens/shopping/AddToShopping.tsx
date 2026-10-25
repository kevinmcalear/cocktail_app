import { useRouter, type Href } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Button, Caption, useToast } from '@/components/ds';
import { useShoppingEdit, useShoppingList } from '@/hooks/useShoppingList';

/**
 * A drink page's missing line on the list (shopping In 2): "Add Cynar to
 * shopping", or that it's on your list already. A toast offers Open list.
 */
export function AddToShopping({ drinkId, buy }: { drinkId: string; buy: readonly { id: string; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const rows = useShoppingList().data ?? [];
  const edit = useShoppingEdit();
  if (!buy.length) return null;
  const listed = buy.filter((b) => rows.some((r) => r.itemId === b.id && !r.gotAt));
  const names = buy.map((b) => b.name).join(' and ');
  if (listed.length === buy.length) return <Caption tone="muted">{`${names} ${buy.length === 1 ? 'is' : 'are'} on your list`}</Caption>;
  const add = () =>
    edit.add.mutate(
      buy.map((b) => ({ itemId: b.id, name: b.name, source: 'drink' as const, forItemId: drinkId })),
      { onSuccess: () => toast.show({ title: `${names} added to Shopping.`, action: { label: 'Open list', onPress: () => router.push('/shopping' as Href) } }) }
    );
  return <Button label={`Add ${names} to shopping`} variant="secondary" icon="basket" onPress={add} style={styles.button} />;
}

const styles = StyleSheet.create({
  button: { alignSelf: 'flex-start' },
});
