import { Platform, StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs, type IconName } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, palateHues, radius, space } from '@/constants/tokens';

export interface StepRowData {
  key: string;
  title: string;
  /** The muted line under it: "Autumn · 8 drinks", "One link for everyone". */
  sub?: string | null;
  /** On the right: "4 of 8"; a done row says "Done" (in green, with no chevron). */
  value?: string | null;
  done: boolean;
  onPress?: () => void;
}

/**
 * A card of steps, each a ring until it's done and a green tick after (board
 * Kept-onboard: "Your first round" and "Set up <bar>"). A done row shows its
 * value in green and no chevron, and still opens its screen to change it; the
 * rest open theirs. Android rows keep no chevron, as Android lists do.
 */
export function StepGroup({ rows, label }: { rows: StepRowData[]; label: string }) {
  const ds = useDs();
  const green = palateHues[ds.scheme].green;
  return (
    <View role="list" accessibilityLabel={label} style={[styles.card, { backgroundColor: ds.c.surface }]}>
      {rows.map((r, i) => {
        const chevron = !r.done && !!r.onPress && Platform.OS !== 'android';
        const inner = (
          <>
            <IconSymbol name={r.done ? 'checkmark.circle' : 'circle'} size={20} color={r.done ? green : ds.c.muted} />
            <View style={styles.text}>
              <Body>{r.title}</Body>
              {r.sub ? <Caption tone="muted">{r.sub}</Caption> : null}
            </View>
            {r.value ? (
              <Body color={r.done ? green : ds.c.muted} numberOfLines={1}>
                {r.value}
              </Body>
            ) : null}
            {chevron ? <IconSymbol name="chevron.right" size={16} color={ds.c.muted} /> : null}
          </>
        );
        const line = i ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ds.c.line } : null;
        const name = [r.title, r.sub, r.value ?? (r.done ? 'Done' : null)].filter(Boolean).join(', ');
        return (
          <View key={r.key} role="listitem" style={line}>
            {r.onPress ? (
              <PressableScale role="button" accessibilityLabel={name} onPress={r.onPress} style={styles.row}>
                {inner}
              </PressableScale>
            ) : (
              <View accessibilityLabel={name} style={styles.row}>
                {inner}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

/** A plain note on a soft fill: an icon and a sentence ("Ana Ruiz set these for new bartenders."). */
export function RoundNote({ icon, text }: { icon: IconName; text: string }) {
  const ds = useDs();
  return (
    <View style={[styles.note, { backgroundColor: ds.c.raised }]}>
      <IconSymbol name={icon} size={20} color={ds.c.ink} />
      <Body style={styles.text}>{text}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, borderCurve: 'continuous', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  text: { flex: 1, minWidth: 0, gap: 2 },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md + 2, borderRadius: radius.card, borderCurve: 'continuous' },
});
