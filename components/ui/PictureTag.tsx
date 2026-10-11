import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

/**
 * A small label pinned to a picture: "May be out of date" on photos taken
 * before the spec changed. Drawings carry none (they're obviously drawings).
 * Fixed light-on-dark so it reads on any photo (better than 7:1).
 */
export function PictureTag({ label, style }: { label: string | null; style?: ViewStyle }) {
  if (!label) return null;
  return (
    <View style={[styles.tag, style]} pointerEvents="none" accessibilityRole="text" accessibilityLabel={label}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(14, 13, 12, 0.72)',
  },
  text: {
    color: '#F3EEE6',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
