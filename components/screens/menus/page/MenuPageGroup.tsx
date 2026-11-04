import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space, STATUS } from '@/constants/tokens';
import { readableAccent } from '@/lib/color';

export interface GroupRow {
  label: string;
  value: string;
  /** Amber: something to fix (grenadine low, a drink with no price). */
  warn?: boolean;
  onPress?: () => void;
}

/** The block under a menu's name: what the person looking needs first ("On · since 1 Oct", "Costing · average 20%"). */
export function MenuPageGroup({ rows }: { rows: GroupRow[] }) {
  const ds = useDs();
  const amber = readableAccent(STATUS.warning, ds.c.ground);
  if (!rows.length) return null;
  return (
    <View style={[styles.group, { backgroundColor: ds.c.raised }]}>
      {rows.map((r, i) => {
        const Row = r.onPress ? PressableScale : View;
        return (
          <Row
            key={r.label}
            role={r.onPress ? 'button' : undefined}
            accessibilityLabel={`${r.label}: ${r.value}`}
            onPress={r.onPress}
            style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ds.c.lineStrong }]}
          >
            <Body style={styles.label}>{r.label}</Body>
            <Caption color={r.warn ? amber : ds.c.muted} style={styles.value} numberOfLines={2}>
              {r.value}
            </Caption>
            {r.onPress ? <IconSymbol name="chevron.right" size={14} color={r.warn ? amber : ds.c.muted} /> : null}
          </Row>
        );
      })}
    </View>
  );
}

/** After the drinks, a quiet note ("Prices are left off past menus"). Nothing else goes under the drinks. */
export function MenuPageAfter({ note, style }: { note: string; style: StyleProp<ViewStyle> }) {
  return (
    <View style={[style, styles.after]}>
      <Caption tone="muted">{note}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  after: { paddingTop: space.xl },
  group: { borderRadius: radius.control, overflow: 'hidden', borderCurve: 'continuous' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, minHeight: 48, paddingVertical: space.sm },
  label: { flex: 1 },
  value: { flexShrink: 1, textAlign: 'right' },
});
