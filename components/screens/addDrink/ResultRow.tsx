import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useIngredientUse } from '@/hooks/useIngredientUse';

/** "On your shelf" (or back bar), else how many drinks use it; a close name adds "tap to use it" (canvas 2A). */
export function UseCaption({ id, have, tap }: { id: string | null; have: string | null; tap: boolean }) {
  const { data: n } = useIngredientUse(have ? null : id);
  const text = [have ?? (n ? `In ${n} ${n === 1 ? 'drink' : 'drinks'}` : null), tap ? 'tap to use it' : null].filter(Boolean).join(' · ');
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
