import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useActiveVenue } from '@/hooks/useActiveVenue';

type FoundRow = { id: string; bar_id?: string | null; ingredient_role?: string | null };

/** Where a found ingredient is from: what you have, a venue's house-made, else the catalog (board q16-2). */
export function whereFrom(r: FoundRow, have: string | null, venues: readonly { id: string; name: string | null }[]): string | null {
  if (have) return have;
  const bar = r.bar_id ? venues.find((v) => v.id === r.bar_id)?.name : null;
  // A house-made one is the venue's, or your own at home; a venue's own bottle says nothing (the board draws no line for it).
  if (r.ingredient_role === 'prep') return bar ? `House-made at ${bar}` : 'House-made';
  return r.bar_id ? null : 'In the catalog';
}

/** Under a found ingredient: where it's from ("On your back bar", "House-made at Little Rye", "In the catalog"); a close name adds "tap to use it" (canvas 2A). */
export function UseCaption({ row, have, tap }: { row: FoundRow | null; have: string | null; tap: boolean }) {
  const { venues } = useActiveVenue();
  const text = [row ? whereFrom(row, have, venues) : have, tap ? 'tap to use it' : null].filter(Boolean).join(' · ');
  return text ? <Caption tone="muted">{text.charAt(0).toUpperCase() + text.slice(1)}</Caption> : null;
}

/** A found ingredient with its drawing, or an action row with its tile: make it in house (+, and on to the builder), or just the name (lines). */
export function ResultRow({ id, label, a11y, sub, caption, icon, onPress }: { id?: string; label: string; a11y?: string; sub?: string; caption?: ReactNode; icon?: 'make' | 'new'; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" onPress={onPress} accessibilityLabel={a11y ?? label} accessibilityHint={sub} style={[styles.result, { borderBottomColor: ds.c.line }]}>
      {icon ? (
        <View style={[styles.tile, { backgroundColor: icon === 'make' ? ds.accentFill.fill : ds.c.raised }]}>
          <IconSymbol name={icon === 'make' ? 'plus' : 'text.alignleft'} size={16} color={icon === 'make' ? ds.accentFill.text : ds.c.muted} />
        </View>
      ) : (
        <IngredientThumb id={id} name={label} size={36} />
      )}
      <View style={styles.flex}>
        <Body numberOfLines={icon ? 2 : 1}>{label}</Body>
        {sub ? <Caption tone="muted">{sub}</Caption> : caption}
      </View>
      {icon === 'make' ? <IconSymbol name="chevron.right" size={14} color={ds.c.muted} /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  result: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + 4, paddingHorizontal: space.md, paddingVertical: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  tile: { width: 36, height: 36, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
