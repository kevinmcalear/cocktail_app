import { StyleSheet, View } from 'react-native';

import { Caption, DsText, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { rowMeta, type TreeRow } from '@/lib/drinkTree';

const INDENT = space.lg;
const MAX_INDENT = 7;

/**
 * One drink or style in the family tree: indent guides for its depth, a dot
 * (a square for a historic style), its name, year, maker and bar. A drink
 * opens its page; the chevron folds what came from it; "from Sour" jumps to
 * the parent in its own family.
 */
export function TreeRowView({
  row,
  folded,
  focused,
  onOpen,
  onToggle,
  onJump,
}: {
  row: TreeRow;
  folded: boolean;
  focused: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onJump: (key: string) => void;
}) {
  const ds = useDs();
  const { node, depth, hasKids, from } = row;
  const indent = Math.min(depth, MAX_INDENT) * INDENT;
  const style = node.kind === 'style';
  const meta = rowMeta(node);
  return (
    <View role="listitem" style={[styles.row, focused ? { backgroundColor: ds.c.raised } : null]}>
      {Array.from({ length: Math.min(depth, MAX_INDENT) }, (_, i) => (
        <View key={i} style={[styles.guide, { left: i * INDENT + space.xs + 1, backgroundColor: ds.c.line }]} />
      ))}
      <PressableScale
        role={style ? 'button' : 'link'}
        accessibilityLabel={[node.name, style ? 'historic style' : null, meta, node.note].filter(Boolean).join('. ')}
        onPress={style ? onToggle : onOpen}
        style={[styles.main, { paddingLeft: indent }]}
      >
        <View
          style={[
            styles.dot,
            style ? styles.square : null,
            { backgroundColor: style ? ds.c.muted : focused ? ds.accentText : ds.c.ink, borderColor: style ? ds.c.muted : ds.c.ink },
          ]}
        />
        <View style={styles.text}>
          {style ? (
            <Caption tone="muted" style={styles.styleName}>
              {node.name}
            </Caption>
          ) : (
            <DsText variant="headline" numberOfLines={2}>
              {node.name}
            </DsText>
          )}
          {meta ? (
            <Caption tone="muted" numberOfLines={2}>
              {meta}
            </Caption>
          ) : null}
          {style && node.note ? (
            <Caption tone="muted" numberOfLines={3}>
              {node.note}
            </Caption>
          ) : null}
        </View>
      </PressableScale>
      {from ? (
        <PressableScale role="link" accessibilityLabel={`From ${from.name}. Show it in its family`} onPress={() => onJump(from.key)} style={styles.from}>
          <Caption tone="muted" style={styles.fromText}>{`from ${from.name}`}</Caption>
        </PressableScale>
      ) : null}
      {hasKids ? (
        <PressableScale
          role="button"
          accessibilityLabel={`${folded ? 'Show' : 'Hide'} what came from ${node.name}`}
          aria-expanded={!folded}
          onPress={onToggle}
          style={styles.toggle}
        >
          <IconSymbol name={folded ? 'chevron.right' : 'chevron.down'} size={16} color={ds.c.muted} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: layout.minTapTarget + space.sm, borderRadius: radius.control, borderCurve: 'continuous' },
  guide: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth * 2 },
  main: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.sm },
  dot: { width: 9, height: 9, borderRadius: radius.pill, borderWidth: 1.5, marginTop: space.sm },
  square: { borderRadius: radius.mark / 2 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  styleName: { letterSpacing: 1.2, textTransform: 'uppercase' },
  from: { minHeight: layout.minTapTarget, justifyContent: 'center', paddingHorizontal: space.xs },
  fromText: { fontStyle: 'italic', textDecorationLine: 'underline' },
  toggle: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
});
