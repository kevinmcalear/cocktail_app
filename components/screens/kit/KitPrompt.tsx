import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Body, Button, Caption, Surface, TextLink } from '@/components/ds';
import { space } from '@/constants/tokens';

interface KitPromptProps {
  /** "Sphere isn’t in Little Rye’s ice." */
  title: string;
  detail: string;
  /** "Add to our ice": opens the Add sheet, filled in. */
  addLabel: string;
  onAdd: () => void;
  onNotNow: () => void;
  /** Once added: "Sphere is in your ice." with a link to the list. */
  added?: string | null;
  listLabel: string;
  onOpenList: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * "Not in your kit, add it?" (Kit and ice, step 12): the same prompt for a
 * glass, an ice or a tool wherever a drink names one the venue doesn't list.
 * Add opens the same Add sheet with what it is already answered.
 */
export function KitPrompt({ title, detail, addLabel, onAdd, onNotNow, added, listLabel, onOpenList, style }: KitPromptProps) {
  if (added) {
    return (
      <View style={[styles.done, style]}>
        <Caption tone="muted">{added}</Caption>
        <TextLink label={listLabel} onPress={onOpenList} />
      </View>
    );
  }
  return (
    <Surface raised style={[styles.card, style]}>
      <View role="group" aria-label={title} style={styles.stack}>
        <Body>{title}</Body>
        <Caption tone="muted">{detail}</Caption>
        <View style={styles.actions}>
          <Button label={addLabel} size="sm" variant="secondary" onPress={onAdd} />
          <Button label="Not now" size="sm" variant="ghost" onPress={onNotNow} />
          <TextLink label={listLabel} tone="ink" onPress={onOpenList} />
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: space.md },
  stack: { gap: space.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  done: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
});
