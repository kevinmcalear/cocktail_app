import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, Display, GlassButton, useGutter } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { useIsWideWeb, useWebNavWidth } from '@/hooks/useIsWideWeb';

import { ScreenHeader } from './ScreenHeader';

type ColumnWidth = 'text' | 'wide' | 'full';

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

function useColumnRightPad(width: ColumnWidth): number {
  const gutter = useGutter();
  const page = useWindowDimensions().width - useWebNavWidth();
  return width === 'full' ? gutter : Math.max(gutter, page - layout.page[width] + gutter);
}

/**
 * The top of a page: the logo / New / You row (or, on a phone, a back button
 * for a page opened from another one), then the title, with the page's main
 * action on the right. Goes first inside a usePageColumn column; pass the
 * same `width`.
 *
 * A subtitle is only for something the page doesn't already say: "2 on now",
 * not the venue's name, which the sidebar and the chip show.
 */
export function PageHeader({ title, subtitle, action, onBack, backLabel = 'Back', width = 'text', wordmark }: {
  title: string;
  /** The venue's name beside the logo on a phone (Tonight only). */
  wordmark?: boolean;
  width?: ColumnWidth;
  subtitle?: string | null;
  action?: ReactNode;
  /** Set on pages opened from another page; phones get a back button instead of the venue row. */
  onBack?: () => void;
  backLabel?: string;
}) {
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const sidebar = useIsWideWeb();
  const rightPad = useColumnRightPad(width);
  return (
    <View style={styles.header}>
      {onBack && !sidebar ? (
        <View style={[styles.back, { paddingTop: insets.top + space.sm }]}>
          <GlassButton icon="chevron.left" accessibilityLabel={backLabel} onPress={onBack} />
        </View>
      ) : (
        // ScreenHeader brings its own gutter, and runs to the page's right edge.
        <View style={{ marginLeft: -gutter, marginRight: -rightPad }}>
          <ScreenHeader wordmark={wordmark} />
        </View>
      )}
      <View style={styles.titleRow}>
        <View style={styles.title}>
          <Display>{title}</Display>
          {subtitle ? <Caption tone="muted">{subtitle}</Caption> : null}
        </View>
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.sm },
  back: { flexDirection: 'row' },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
  title: { gap: space.xs, flexShrink: 1 },
  action: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
