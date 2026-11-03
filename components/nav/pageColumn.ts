import { useWindowDimensions, type ViewStyle } from 'react-native';

import { useGutter } from '@/components/ds';
import { layout } from '@/constants/tokens';
import { useWebNavWidth } from '@/hooks/useIsWideWeb';

export type ColumnWidth = 'text' | 'wide' | 'full';

/**
 * The column a page's scroll content sits in: the gutter either side, and on
 * wide screens a maximum width, left-aligned next to the sidebar so every page
 * starts at the same edge. 'full' is for grids that use the whole width.
 *
 * The cap is right padding rather than maxWidth, so a list's rows can still
 * scroll from the window's right edge.
 */
export function usePageColumn(width: ColumnWidth = 'text'): ViewStyle {
  const gutter = useGutter();
  return { width: '100%', paddingLeft: gutter, paddingRight: useColumnRightPad(width) };
}

export function useColumnRightPad(width: ColumnWidth): number {
  const gutter = useGutter();
  const page = useWindowDimensions().width - useWebNavWidth();
  return width === 'full' ? gutter : Math.max(gutter, page - layout.page[width] + gutter);
}
