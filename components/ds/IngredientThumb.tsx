import { StyleSheet, View } from 'react-native';

import { radius } from '@/constants/tokens';

import { IngredientDrawing } from './IngredientDrawing';

/**
 * A small picture of an ingredient for search, picker and spec rows: its
 * drawing on the house paper. Decorative: the row's name says what it is.
 */
export function IngredientThumb({ id, name, size = 40 }: { id?: string | null; name: string; size?: number }) {
  return (
    <View aria-hidden style={[styles.frame, { width: size, height: size }]}>
      <IngredientDrawing id={id} name={name} detail="thumb" />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.control, borderCurve: 'continuous', overflow: 'hidden' },
});
