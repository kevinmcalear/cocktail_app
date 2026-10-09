import { StyleSheet, View } from 'react-native';

import { radius } from '@/constants/tokens';

import { EquipmentDrawing } from './EquipmentDrawing';

/**
 * A small picture of a piece of bar kit for lists and tiles: its drawing on
 * the house paper. Decorative: the row's name says what it is.
 */
export function EquipmentThumb({ id, size = 40 }: { id: string; name: string; size?: number }) {
  return (
    <View aria-hidden style={[styles.frame, { width: size, height: size }]}>
      <EquipmentDrawing id={id} detail="thumb" />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.control, borderCurve: 'continuous', overflow: 'hidden' },
});
