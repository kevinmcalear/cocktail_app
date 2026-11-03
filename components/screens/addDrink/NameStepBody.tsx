import { StyleSheet, View } from 'react-native';

import { Caption, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { withArticle } from '@/lib/closestClassic';


/** "Give it a name that tells it apart", ticked once it does. */
export function ApartHint({ done, words }: { done: boolean; words: string }) {
  const ds = useDs();
  return (
    <View style={styles.hint}>
      {done ? <IconSymbol name="checkmark" size={14} color={ds.c.muted} /> : null}
      <Caption tone="muted" style={styles.flex}>
        {words}
      </Caption>
    </View>
  );
}

/** The word makes a name the bar has too ("Negroni (summer)" is there already): Next waits for another. */
export function TakenWord({ bar, name }: { bar: string; name: string }) {
  return <Caption tone="accent">{`${bar ? `${bar} already has` : 'You already have'} ${withArticle(name.trim())}. Try another word.`}</Caption>;
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  field: { gap: space.sm },
  card: { gap: space.sm },
  hint: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  flex: { flex: 1 },
  undo: { alignSelf: 'flex-start' },
});
