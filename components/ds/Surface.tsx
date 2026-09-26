import type { ReactNode } from 'react';
import { useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import { layout, radius, space } from '@/constants/tokens';

import { useDs } from './theme';

export type Breakpoint = 'phone' | 'tablet' | 'desktop';

/** Phone under 768, tablet to 1199, desktop from 1200 (docs/design_system.md#layout). */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  if (width >= layout.breakpoints.desktop) return 'desktop';
  if (width >= layout.breakpoints.tablet) return 'tablet';
  return 'phone';
}

/** Side gutter for the current width. */
export function useGutter(): number {
  return layout.gutter[useBreakpoint()];
}

/**
 * A card: the one thing on a screen that needs lifting. Don't wrap every block
 * in one; most content sits straight on the ground.
 */
export function Surface({ children, raised, style }: { children: ReactNode; raised?: boolean; style?: StyleProp<ViewStyle> }) {
  const ds = useDs();
  return (
    <View
      style={[
        { backgroundColor: raised ? ds.c.raised : ds.c.surface, borderRadius: radius.card, borderCurve: 'continuous', padding: space.lg },
        style,
      ]}
    >
      {children}
    </View>
  );
}
