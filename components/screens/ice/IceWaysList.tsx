import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, radius, space } from '@/constants/tokens';
import { ICE_WAYS, type IceWayKey } from '@/lib/iceRecipes';

/**
 * How do you make it? (Kit and ice, step 6): the six common ways, each saying
 * what it starts from and needs, and the other six behind "More ways". Picking
 * one is a starting recipe in our words. The Add sheet (PR 2) asks it as
 * question 3; the recipe page asks it while an ice has no steps yet.
 */
export function IceWaysList({ value, onChange }: { value: IceWayKey | null; onChange: (key: IceWayKey) => void }) {
  const ds = useDs();
  const [more, setMore] = useState(() => !!value && !ICE_WAYS.find((w) => w.key === value)?.common);
  const ways = ICE_WAYS.filter((w) => w.common || more);
  return (
    <View role="radiogroup" accessibilityLabel="How do you make it?" style={styles.list}>
      {ways.map((w) => {
        const on = w.key === value;
        return (
          <PressableScale
            key={w.key}
            role="radio"
            aria-checked={on}
            accessibilityLabel={`${w.title}. ${w.line}`}
            onPress={() => onChange(w.key)}
            style={[styles.row, { backgroundColor: on ? ds.c.raised : ds.c.surface, borderColor: on ? ds.c.ink : ds.c.line }]}
          >
            <View style={styles.flex}>
              <Body style={styles.title}>{w.title}</Body>
              <Caption tone="muted">{w.line}</Caption>
            </View>
            {on ? <IconSymbol name="checkmark.circle.fill" size={20} color={ds.c.ink} /> : <View style={[styles.ring, { borderColor: ds.c.lineStrong }]} />}
          </PressableScale>
        );
      })}
      {!more ? (
        <PressableScale role="button" accessibilityLabel="Six more ways: carve, shave, stamp, something frozen inside, flavoured, or write our own" onPress={() => setMore(true)} style={styles.more}>
          <Body tone="accent">6 more ways: carve, shave, stamp…</Body>
          <IconSymbol name="chevron.down" size={14} color={ds.accentText} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm, minHeight: 56, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fontFamilies.bodySemiBold },
  ring: { width: 20, height: 20, borderRadius: radius.pill, borderWidth: 1.5 },
  more: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 44 },
});
