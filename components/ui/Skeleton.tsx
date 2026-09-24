import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from 'tamagui';

/**
 * A placeholder block in the shape of content that is still loading. Pulses
 * gently, or holds still when the system asks for reduced motion.
 */
export function Skeleton({
  width = '100%',
  height,
  radius = 8,
  style,
}: {
  width?: DimensionValue;
  height: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(withTiming(0.45, { duration: 900 }), -1, true);
  }, [reduceMotion, opacity]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: theme.color4?.get() as string }, pulse, style]}
    />
  );
}

/** Lines of text still loading; the last line is shorter, like a paragraph. */
export function SkeletonLines({ lines = 3, lineHeight = 14, gap = 10 }: { lines?: number; lineHeight?: number; gap?: number }) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={lineHeight} width={i === lines - 1 && lines > 1 ? '60%' : '100%'} radius={4} />
      ))}
    </View>
  );
}

/** A drink, beer, wine or ingredient page still loading: photo, title, then details. */
export function DetailSkeleton({ imageHeight }: { imageHeight: number }) {
  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar" style={styles.detail}>
      <Skeleton height={imageHeight} radius={0} />
      <View style={styles.detailBody}>
        <Skeleton height={34} width="70%" radius={6} />
        <View style={styles.pills}>
          <Skeleton height={28} width={88} radius={14} />
          <Skeleton height={28} width={72} radius={14} />
          <Skeleton height={28} width={96} radius={14} />
        </View>
        <SkeletonLines lines={4} />
        <SkeletonLines lines={3} />
      </View>
    </View>
  );
}

/** A grid of item cards (image over a caption) still loading. */
export function CardRowSkeleton({ cards = 3, cardWidth = 120 }: { cards?: number; cardWidth?: number }) {
  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar" style={styles.cardRow}>
      {Array.from({ length: cards }, (_, i) => (
        <View key={i} style={{ width: cardWidth, gap: 8 }}>
          <Skeleton height={cardWidth} radius={12} />
          <Skeleton height={12} width="70%" radius={4} />
        </View>
      ))}
    </View>
  );
}

/** Rows in a list still loading: an icon and a label each. */
export function ListRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar" style={{ gap: 14 }}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.listRow}>
          <Skeleton height={24} width={24} radius={6} />
          <Skeleton height={14} width={`${55 - (i % 3) * 10}%`} radius={4} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  detail: { flex: 1 },
  detailBody: { padding: 24, gap: 24 },
  pills: { flexDirection: 'row', gap: 8 },
  cardRow: { flexDirection: 'row', gap: 12 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
