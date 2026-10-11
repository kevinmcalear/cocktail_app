import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Caption, Field, GlassButton, PressableScale, Segmented, Title, useDs, useGutter } from '@/components/ds';
import { layout, space } from '@/constants/tokens';
import { FAMILIES, rowMeta, searchTree, type TreeNode } from '@/lib/drinkTree';

export type HistoryView = 'tree' | 'timeline';
const VIEWS = [
  { value: 'tree', label: 'Tree' },
  { value: 'timeline', label: 'Timeline' },
] as const;

/**
 * History's header, as drawn: on phones a compact bar (Back, Tree | Timeline,
 * a search button that opens the field); on desktop the eyebrow, "History"
 * and the tabs at the right, with the search field under them. Search works
 * in both views: a match jumps to the drink.
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
  const [query, setQuery] = useState('');
  const results = searchTree(nodes, query);
  const tabs = <Segmented accessibilityLabel="History view" options={VIEWS} value={view} onChange={onView} />;
  const field = (
    <Field
      label="Find a drink, bartender or bar"
      value={query}
      onChangeText={setQuery}
      placeholder="Penicillin, Ada Coleman, Pegu Club"
      autoCorrect={false}
      autoCapitalize="none"
      autoFocus={!wide}
    />
  );
  const pick = (key: string) => {
    onJump(key);
    setQuery('');
    setOpen(false);
  };

  return (
    <View style={[styles.bar, { paddingTop: insets.top + (wide ? space.xl : space.sm), paddingHorizontal: gutter, borderBottomColor: ds.c.line }]}>
      {wide ? (
        <View style={styles.wideHead}>
          <View style={styles.flex}>
            {eyebrow ? <Caption tone="muted">{eyebrow}</Caption> : null}
            <Title>History</Title>
          </View>
          <View style={styles.wideTabs}>{tabs}</View>
        </View>
      ) : (
        <View style={styles.row}>
          <GlassButton
            accessibilityLabel={Platform.OS === 'web' ? 'Back' : 'Close'}
            icon={Platform.OS === 'web' ? 'chevron.left' : 'xmark'}
            onPress={onBack}
          />
          <View style={styles.flex}>{tabs}</View>
          <GlassButton accessibilityLabel={open ? 'Close search' : 'Find a drink, bartender or bar'} icon={open ? 'xmark' : 'magnifyingglass'} onPress={() => setOpen(!open)} />
        </View>
      )}
      {wide || open ? field : null}
      {query.trim() ? (
        <View role="list" aria-label="Matches">
          {results.length ? (
            results.map((n) => (
              <PressableScale key={n.key} role="button" accessibilityLabel={`Show ${n.name}`} onPress={() => pick(n.key)} style={[styles.result, { borderBottomColor: ds.c.line }]}>
                <Body numberOfLines={1}>{n.name}</Body>
                <Caption tone="muted" numberOfLines={1}>
                  {[FAMILIES.find((f) => f.key === n.family)?.name, rowMeta(n)].filter(Boolean).join(' · ')}
                </Caption>
              </PressableScale>
            ))
          ) : (
            <Caption tone="muted">{`Nothing in the history matches "${query.trim()}".`}</Caption>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { gap: space.md, paddingBottom: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  wideHead: { flexDirection: 'row', alignItems: 'flex-end', gap: space.lg },
  wideTabs: { width: 260 },
  flex: { flex: 1, minWidth: 0 },
  result: { minHeight: layout.minTapTarget + space.sm, justifyContent: 'center', paddingVertical: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
});
