import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, Display, GlassButton, useGutter } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';

import { ScreenHeader } from './ScreenHeader';

/**
 * The column a page's scroll content sits in: the gutter either side, and on
 * wide screens a maximum width, left-aligned next to the sidebar so every page
 * starts at the same edge. 'full' is for grids that use the whole width.
 */
export function usePageColumn(width: 'text' | 'wide' | 'full' = 'text'): ViewStyle {
  const gutter = useGutter();
  return { width: '100%', maxWidth: width === 'full' ? undefined : layout.page[width], paddingHorizontal: gutter };
}

/**
 * The top of a page: the venue / New / You row (or, on a phone, a back button
 * for a page opened from another one), then the title, with the page's main
 * action on the right. Goes first inside a usePageColumn column.
 *
 * A subtitle is only for something the page doesn't already say: "2 on now",
 * not the venue's name, which the sidebar and the chip show.
 */
export function PageHeader({ title, subtitle, action, onBack, backLabel = 'Back' }: {
  title: string;
  subtitle?: string | null;
  action?: ReactNode;
  /** Set on pages opened from another page; phones get a back button instead of the venue row. */
  onBack?: () => void;
  backLabel?: string;
}) {
  const gutter = useGutter();
  const insets = useSafeAreaInsets();
  const sidebar = useIsWideWeb();
  return (
    <View style={styles.header}>
      {onBack && !sidebar ? (
        <View style={[styles.back, { paddingTop: insets.top + space.sm }]}>
          <GlassButton icon="chevron.left" accessibilityLabel={backLabel} onPress={onBack} />
        </View>
      ) : (
        // ScreenHeader brings its own gutter.
        <View style={{ marginHorizontal: -gutter }}>
          <ScreenHeader />
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
