import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button, Caption } from '@/components/ds';
import { space } from '@/constants/tokens';

import { useCollectToggle, type CollectTarget } from './useCollectToggle';

/** Collect a published drink or a live release, or let it go again (useCollectToggle). */
export function CollectButton({
  target,
  name,
  quiet = false,
  labels = ['Collect', 'Collected'],
  style,
}: {
  target: CollectTarget;
  name: string;
  /** Outlined even before it's collected, beside a stronger action. */
  quiet?: boolean;
  /** Its words before and after: the public drink page says "To make" (ppl-pub-drink-desktop). */
  labels?: [string, string];
  style?: StyleProp<ViewStyle>;
}) {
  const { saved, toggle, error, pending, sheet } = useCollectToggle(target, name);
  return (
    <View style={styles.wrap}>
      <Button
        label={saved ? labels[1] : labels[0]}
        icon={saved ? 'bookmark.fill' : 'bookmark'}
        variant={saved || quiet ? 'secondary' : 'primary'}
        disabled={pending}
        accessibilityHint={saved ? `Removes ${name} from your collection` : `Keeps ${name} in your collection`}
        onPress={toggle}
        style={style}
      />
      {error ? <Caption tone="accent">{error}</Caption> : null}
      {sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs, alignItems: 'flex-start' },
});
