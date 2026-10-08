import { ScrollView, StyleSheet, View } from 'react-native';

import { Caption, Chip, GlassSurface, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import type { TreeNode } from '@/lib/drinkTree';
import { shortYear } from '@/lib/timeline';

/**
 * A drink's thread back to the punch bowl as a row of steps; each step
 * scrolls the timeline to it. Floats in glass over a phone's timeline, sits
 * in the header on desktop.
 */
export function ThreadBar({
  line,
  focusKey,
  onStep,
  onClose,
  floating,
  bottom = 0,
}: {
  line: TreeNode[];
  focusKey: string | null;
  onStep: (key: string) => void;
  onClose: () => void;
  floating: boolean;
  bottom?: number;
}) {
  const ds = useDs();
  const last = line.at(-1)!;
  const span = line[0]?.year != null && last.year != null ? last.year - line[0].year : null;
  const steps = (
    <View role="list" style={[styles.steps, floating ? null : styles.wrapSteps]}>
      {line.map((n) => (
        <Chip key={n.key} label={`${shortYear(n)} ${n.name}`.trim()} selected={n.key === focusKey} onPress={() => onStep(n.key)} quiet />
      ))}
    </View>
  );
  const body = (
    <>
      <View style={styles.head}>
        <Caption tone="muted" style={styles.flex} numberOfLines={1}>
          {`${last.name}'s thread${span ? ` · ${span} years` : ''}`}
        </Caption>
        <PressableScale role="button" accessibilityLabel="Stop following the thread" onPress={onClose} style={styles.close}>
          <IconSymbol name="xmark" size={16} color={ds.c.muted} />
        </PressableScale>
      </View>
      {floating ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {steps}
        </ScrollView>
      ) : (
        steps
      )}
    </>
  );
  if (!floating) return <View style={[styles.card, { backgroundColor: ds.c.raised }]}>{body}</View>;
  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <GlassSurface style={styles.glass}>{body}</GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.md },
  close: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  steps: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.md },
  wrapSteps: { flexWrap: 'wrap' },
  card: { borderRadius: radius.card, borderCurve: 'continuous', paddingBottom: space.md },
  wrap: { position: 'absolute', left: space.md, right: space.md },
  glass: { borderRadius: radius.card, paddingBottom: space.md },
});
