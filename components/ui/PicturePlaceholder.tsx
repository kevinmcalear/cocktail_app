import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from 'tamagui';

import { CustomIcon } from '@/components/ui/CustomIcons';

/**
 * Stands in for an item's picture until it has one. New items get a sketch
 * drawn by the server within a minute or so, so this stays quiet: a plain
 * surface with a faint glass, never someone else's drink.
 */
export function PicturePlaceholder({ iconSize = 72, style }: { iconSize?: number; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundStrong?.get() as string }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="No picture yet"
    >
      <View style={styles.icon}>
        <CustomIcon name="Coupette" size={iconSize} color={theme.color11?.get() as string} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    opacity: 0.25,
  },
});
