import { StyleSheet, View } from 'react-native';

import { Button, Caption } from '@/components/ds';
import { space } from '@/constants/tokens';

import { useCollectToggle, type CollectTarget } from './useCollectToggle';

/** Collect a published drink or a live release, or let it go again (useCollectToggle). */
export function CollectButton({ target, name }: { target: CollectTarget; name: string }) {
  const { saved, toggle, error, pending, sheet } = useCollectToggle(target, name);
  return (
    <View style={styles.wrap}>
      <Button
        label={saved ? 'Collected' : 'Collect'}
        icon={saved ? 'bookmark.fill' : 'bookmark'}
        variant={saved ? 'secondary' : 'primary'}
        disabled={pending}
        accessibilityHint={saved ? `Removes ${name} from your collection` : `Keeps ${name} in your collection`}
        onPress={toggle}
      />
      {error ? <Caption tone="accent">{error}</Caption> : null}
      {sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs, alignItems: 'flex-start' },
});
