import { StyleSheet, View } from 'react-native';

import { space } from '@/constants/tokens';

import type { DrinkSections } from './DrinkSections';

/**
 * The drink page's blocks in one column, in the board's fixed order (canvas
 * GWBCX, Decided-who-*): the name, what a guest or the floor reads first, where
 * its score stands, the spec, the one action, notes, the bar's own rows, its menus and the story.
 * Each block is already empty for anyone it isn't for.
 */
export function DrinkBody({ sections: s, title = true }: { sections: DrinkSections; title?: boolean }) {
  return (
    <View style={styles.body}>
      {title ? s.title : null}
      {s.lead}
      {s.score}
      {s.spec}
      {s.action}
      {s.notes}
      {s.bar}
      {s.menus}
      {s.story}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.xl },
});
