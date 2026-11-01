import { Platform, StyleSheet, View } from 'react-native';

import { DsText, Headline, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space, STATUS } from '@/constants/tokens';

import { useTile } from './MaterialBar';

export interface GroupRow {
  key: string;
  label: string;
  /** On the right, muted: "Made 30 Oct · 2 left", "$3.10 · 82%". */
  value?: string | null;
  /** The value in the warning ink: what the bar lacks ("Glass  Wine", Kept-kit). */
  warn?: boolean;
  onPress?: () => void;
}

/**
 * A titled group of rows on a quiet fill (boards Draw-scroll, Item-page:
 * "Behind the bar", "Pour it", "At Caretaker's"). Rows that open something
 * show a chevron; on Android the whole row ripples and there is no chevron,
 * as Android lists are. Batch, cost and menus are rows here, never buttons.
 */
export function RowGroup({ title, rows }: { title?: string; rows: GroupRow[] }) {
  const ds = useDs();
  const tile = useTile();
  const warnInk = ds.scheme === 'dark' ? STATUS.warning : ds.c.ink;
  if (!rows.length) return null;
  return (
    <View style={styles.group}>
      {title ? (
        <Headline role="heading" aria-level={2}>
          {title}
        </Headline>
      ) : null}
      <View style={tile ? styles.tiles : [styles.card, { backgroundColor: ds.c.raised }]}>
        {rows.map((r, i) => {
          const inner = (
            <>
              <DsText variant="label" style={styles.label}>
                {r.label}
              </DsText>
              {r.value ? (
                <DsText variant="label" tone={r.warn ? undefined : 'muted'} color={r.warn ? warnInk : undefined} align="right" style={[styles.value, r.warn ? styles.warn : null]}>
                  {r.value}
                </DsText>
              ) : null}
              {r.onPress && Platform.OS !== 'android' ? <IconSymbol name="chevron.right" size={14} color={ds.c.muted} /> : null}
            </>
          );
          const line = tile ? tile(i, rows.length) : i ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ds.c.line } : null;
          return r.onPress ? (
            <PressableScale key={r.key} role="button" accessibilityLabel={[r.label, r.value].filter(Boolean).join(', ')} onPress={r.onPress} android_ripple={{ color: ds.c.line }} style={[styles.row, line]}>
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
  tiles: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md + 2, paddingHorizontal: space.lg },
  label: { flexShrink: 1 },
  value: { flex: 1 },
  warn: { fontWeight: '600' },
  fact: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md, paddingVertical: space.sm + 3, borderTopWidth: StyleSheet.hairlineWidth },
  factChevron: { alignSelf: 'center', marginLeft: -space.xs },
});

/**
 * The facts a menu gives, as ruled rows: label left, value right (board
 * Item-page: Strength, Pour, Served; Keeps, Store, Takes). A row that opens
 * something ends in a chevron ("Kind of  Scotch ›"); on Android the row
 * ripples instead.
 */
export function FactRows({ rows }: { rows: { label: string; value: string; onPress?: () => void; accessibilityHint?: string }[] }) {
  const ds = useDs();
  if (!rows.length) return null;
  return (
    <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ds.c.line }}>
      {rows.map((r) => {
        const inner = (
          <>
            <DsText variant="body" tone="muted">
              {r.label}
            </DsText>
            <DsText variant="body" align="right" style={styles.value}>
              {r.value}
            </DsText>
            {r.onPress && Platform.OS !== 'android' ? <IconSymbol name="chevron.right" size={14} color={ds.c.muted} style={styles.factChevron} /> : null}
          </>
        );
        return r.onPress ? (
          <PressableScale key={r.label} role="link" accessibilityLabel={`${r.label}: ${r.value}`} accessibilityHint={r.accessibilityHint} onPress={r.onPress} android_ripple={{ color: ds.c.line }} style={[styles.fact, { borderTopColor: ds.c.line }]}>
            {inner}
          </PressableScale>
        ) : (
          <View key={r.label} accessible accessibilityLabel={`${r.label}: ${r.value}`} style={[styles.fact, { borderTopColor: ds.c.line }]}>
            {inner}
          </View>
        );
      })}
    </View>
  );
}
