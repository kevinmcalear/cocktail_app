import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Caption, GlassButton, Segmented, Title, useDs, useGutter } from '@/components/ds';
import { fontFamilies, layout, space } from '@/constants/tokens';
import { useViewAs } from '@/hooks/useViewAs';
import type { TreeNode } from '@/lib/drinkTree';

import { HistorySearch } from './HistorySearch';

export type HistoryView = 'tree' | 'timeline';
const VIEWS = [
  { value: 'tree', label: 'Tree' },
  { value: 'timeline', label: 'Timeline' },
] as const;

/**
 * History's header, as drawn: on phones a compact bar (Back, Tree | Timeline
 * in the middle, a search button that opens the field); on desktop the
 * eyebrow, "History" and the tabs at the right. Desktop's search sits in the
 * content row (HistorySearch). A match jumps to the drink.
 */
export function HistoryTopBar({
  view,
  onView,
  wide,
  eyebrow,
  nodes,
  onJump,
  onBack,
}: {
  view: HistoryView;
  onView: (v: HistoryView) => void;
  wide: boolean;
  eyebrow: string;
  nodes: readonly TreeNode[];
  onJump: (key: string) => void;
  onBack: () => void;
}) {
  const ds = useDs();
  const insets = useSafeAreaInsets();
  const gutter = useGutter();
  const [open, setOpen] = useState(false);
  // View as's banner floats at the top of the screen: on a phone, the bar starts under it so the tabs stay tappable.
  const viewingAs = useViewAs().viewAsRoleLevel != null;
  const tabs = <Segmented accessibilityLabel="History view" options={VIEWS} value={view} onChange={onView} />;

  return (
    <View
      style={[
        styles.bar,
        wide ? null : { borderBottomColor: ds.c.line, borderBottomWidth: StyleSheet.hairlineWidth },
        { paddingTop: insets.top + (wide ? space.xl : space.sm + (viewingAs ? layout.minTapTarget + space.sm : 0)), paddingHorizontal: gutter },
      ]}
    >
      {wide ? (
        <View style={styles.wideHead}>
          <View style={styles.flex}>
            {eyebrow ? (
              <Caption tone="muted" style={styles.eyebrow}>
                {eyebrow}
              </Caption>
            ) : null}
            <Title>History</Title>
          </View>
          {tabs}
        </View>
      ) : (
        <View style={styles.row}>
          <GlassButton accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'} icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'} onPress={onBack} />
          <View style={styles.center}>{tabs}</View>
          <GlassButton accessibilityLabel={open ? 'Close search' : 'Find a drink, bartender or bar'} icon={open ? 'xmark' : 'magnifyingglass'} onPress={() => setOpen(!open)} />
        </View>
      )}
      {!wide && open ? (
        <HistorySearch
          nodes={nodes}
          autoFocus
          onJump={(key) => {
            onJump(key);
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { gap: space.md, paddingBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  center: { flex: 1, minWidth: 0, alignItems: 'center' },
  wideHead: { flexDirection: 'row', alignItems: 'flex-end', gap: space.lg },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1.2, textTransform: 'uppercase' },
  flex: { flex: 1, minWidth: 0 },
});
