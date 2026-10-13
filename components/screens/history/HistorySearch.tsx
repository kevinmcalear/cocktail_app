import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Field, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';
import { FAMILIES, rowMeta, searchTree, type TreeNode } from '@/lib/drinkTree';

/**
 * Find a drink, bartender or bar in the history: a field with a search icon
 * and the matches under it. A match jumps to the drink. On phones it opens
 * from the top bar; on desktop it sits in the content row beside All |
 * Modern classics (board prep-hist-tree-desktop).
 */
export function HistorySearch({ nodes, onJump, autoFocus, compact }: { nodes: readonly TreeNode[]; onJump: (key: string) => void; autoFocus?: boolean; compact?: boolean }) {
  const ds = useDs();
  const [query, setQuery] = useState('');
  const results = searchTree(nodes, query);
  const pick = (key: string) => {
    onJump(key);
    setQuery('');
  };
  return (
    <View style={compact ? styles.compact : null}>
      <Field
        label="Find a drink, bartender or bar"
        hideLabel
        value={query}
        onChangeText={setQuery}
        placeholder="Find a drink, bartender or bar"
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={autoFocus}
        trailing={
          <View style={styles.icon} aria-hidden>
            <IconSymbol name="magnifyingglass" size={16} color={ds.c.muted} />
          </View>
        }
      />
      {query.trim() ? (
        <View role="list" aria-label="Matches" style={[styles.results, compact ? { backgroundColor: ds.c.surface, borderColor: ds.c.line } : null, compact ? styles.float : null]}>
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
  compact: { flexGrow: 1, flexBasis: 240, maxWidth: 340, zIndex: 2 },
  icon: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  results: { paddingTop: space.xs },
  float: { position: 'absolute', top: layout.minTapTarget + space.xs, left: 0, right: 0, paddingHorizontal: space.md, borderRadius: space.md, borderWidth: StyleSheet.hairlineWidth },
  result: { minHeight: layout.minTapTarget + space.sm, justifyContent: 'center', paddingVertical: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
});
