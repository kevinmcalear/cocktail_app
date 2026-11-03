import { StyleSheet, View } from 'react-native';

import { radius } from '@/constants/tokens';

import { IngredientDrawing } from './IngredientDrawing';
import { useDs } from './theme';

/**
 * A small picture of an ingredient for search, picker and spec rows: its
 * drawing on the house paper (a night tile in dark). Decorative: the row's name says what it is.
 */
export function IngredientThumb({ id, name, size = 40 }: { id?: string | null; name: string; size?: number }) {
  const ds = useDs();
  // In dark the drawing is painted for night on a night tile (ds.c.tilePaper), not left on cream paper.
  return (
    <View aria-hidden style={[styles.frame, { width: size, height: size, backgroundColor: ds.c.tilePaper }]}>
      <IngredientDrawing id={id} name={name} detail="thumb" bare night />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.control, borderCurve: 'continuous', overflow: 'hidden' },
});
