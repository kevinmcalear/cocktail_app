import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { useDs } from '@/components/ds';
import { Pulse } from '@/components/ds/Pulse';
import { radius as RADIUS, space } from '@/constants/tokens';

/**
 * A placeholder block in the shape of content that is still loading. Pulses
 * gently, or holds still when the system asks for reduced motion.
 */
export function Skeleton({
  width = '100%',
  height,
  radius = RADIUS.control,
  style,
}: {
  width?: DimensionValue;
  height: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const ds = useDs();
  return <Pulse style={[{ width, height, borderRadius: radius, borderCurve: 'continuous', backgroundColor: ds.c.raised }, style]} />;
}

/** Lines of text still loading; the last line is shorter, like a paragraph. */
export function SkeletonLines({ lines = 3, lineHeight = 14, gap = space.sm + 2 }: { lines?: number; lineHeight?: number; gap?: number }) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={lineHeight} width={i === lines - 1 && lines > 1 ? '60%' : '100%'} radius={RADIUS.mark} />
      ))}
    </View>
  );
}

/** A drink, beer, wine or ingredient page still loading: photo, title, then details. */
export function DetailSkeleton({ imageHeight }: { imageHeight: number }) {
  return (
    <View aria-label="Loading" role="progressbar" style={styles.detail}>
      <Skeleton height={imageHeight} radius={0} />
      <View style={styles.detailBody}>
        <Skeleton height={34} width="70%" radius={RADIUS.mark} />
        <View style={styles.pills}>
          <Skeleton height={28} width={88} radius={RADIUS.pill} />
          <Skeleton height={28} width={72} radius={RADIUS.pill} />
          <Skeleton height={28} width={96} radius={RADIUS.pill} />
        </View>
        <SkeletonLines lines={4} />
        <SkeletonLines lines={3} />
      </View>
    </View>
  );
}

/** Rows in a list still loading: an icon and a label each. */
export function ListRowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View aria-label="Loading" role="progressbar" style={styles.rows}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.listRow}>
          <Skeleton height={24} width={24} radius={RADIUS.mark} />
          <Skeleton height={14} width={`${55 - (i % 3) * 10}%`} radius={RADIUS.mark} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  detail: { flex: 1 },
  detailBody: { padding: space.xl, gap: space.xl },
  pills: { flexDirection: 'row', gap: space.sm },
  rows: { gap: space.md + 2 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
