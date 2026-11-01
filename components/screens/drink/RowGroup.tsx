import { Platform, StyleSheet, View } from 'react-native';

import { DsText, Headline, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';

export interface GroupRow {
  key: string;
  label: string;
  /** On the right, muted: "Made 30 Oct · 2 left", "$3.10 · 82%". */
  value?: string | null;
  onPress?: () => void;
}

/**
 * A titled group of rows on a quiet fill (boards Draw-scroll, Item-page:
 * "Behind the bar", "Pour it", "At Caretaker's"). Rows that open something
 * show a chevron; on Android the whole row ripples and there is no chevron,
 * as Android lists are. Batch, cost and menus are rows here, never buttons.
 */
export function RowGroup({ title, rows }: { title: string; rows: GroupRow[] }) {
  const ds = useDs();
  if (!rows.length) return null;
  return (
    <View style={styles.group}>
      <Headline role="heading" aria-level={2}>
        {title}
      </Headline>
      <View style={[styles.card, { backgroundColor: ds.c.raised }]}>
        {rows.map((r, i) => {
          const inner = (
            <>
              <DsText variant="label" style={styles.label}>
                {r.label}
              </DsText>
              {r.value ? (
                <DsText variant="label" tone="muted" align="right" style={styles.value}>
                  {r.value}
                </DsText>
              ) : null}
              {r.onPress && Platform.OS !== 'android' ? <IconSymbol name="chevron.right" size={14} color={ds.c.muted} /> : null}
            </>
          );
          const line = i ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ds.c.line } : null;
          return r.onPress ? (
            <PressableScale key={r.key} role="button" accessibilityLabel={[r.label, r.value].filter(Boolean).join(', ')} onPress={r.onPress} style={[styles.row, line]}>
              {inner}
            </PressableScale>
          ) : (
            <View key={r.key} style={[styles.row, line]}>
              {inner}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm + 2 },
  card: { borderRadius: radius.card - space.xs, borderCurve: 'continuous', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md + 2, paddingHorizontal: space.lg },
  label: { flexShrink: 1 },
  value: { flex: 1 },
});
