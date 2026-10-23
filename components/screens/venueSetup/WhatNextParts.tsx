import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { GlassThumb } from '@/components/glass/GlassModelPicker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { STATUS } from '@/constants/palette';
import { fontFamilies, radius, space } from '@/constants/tokens';
import type { BarGlass } from '@/hooks/useBarGlassware';

const SLOTS = 6;

/** A glass on the drawn shelf: one on the page, or one held until it's checked. */
export type ShelfGlass = Pick<BarGlass, 'id' | 'glass' | 'variant'>;

const many = (n: number, one: string, more: string) => (n === 1 ? `one ${one}` : `${n} ${more}`);

/**
 * The bar's back bar, drawn: a shelf of empty spots that fill with the real
 * drawing of each glass picked, and one below for the bottles on the back
 * bar. Past six, the last spot counts the rest.
 */
export function BackBarShelf({ name, glasses, bottles }: { name: string; glasses: readonly ShelfGlass[]; bottles: readonly { id: string; name: string }[] }) {
  const ds = useDs();
  return (
    <View
      role="img"
      aria-label={`${name}’s back bar, drawn: ${many(glasses.length, 'glass', 'glasses')} and ${many(bottles.length, 'bottle', 'bottles')} so far`}
      style={[styles.shelf, { backgroundColor: ds.c.ground, borderColor: ds.c.line }]}
    >
      <Shelf items={glasses} draw={(g) => <GlassThumb glass={g.glass} variant={g.variant} size={44} />} />
      <Shelf items={bottles} draw={(b) => <IngredientThumb id={b.id} name={b.name} size={44} />} />
    </View>
  );
}

function Shelf<T extends { id: string }>({ items, draw }: { items: readonly T[]; draw: (item: T) => ReactNode }) {
  const ds = useDs();
  const extra = items.length > SLOTS ? items.length - (SLOTS - 1) : 0;
  const shown = items.slice(0, extra ? SLOTS - 1 : SLOTS);
  return (
    <View style={styles.row}>
      <View style={styles.slots}>
        {Array.from({ length: SLOTS }, (_, i) => {
          const item = shown[i];
          if (item) {
            return (
              <View key={item.id} style={[styles.slot, { backgroundColor: ds.c.paper }]}>
                {draw(item)}
              </View>
            );
          }
          if (extra && i === SLOTS - 1) {
            return (
              <View key="more" style={[styles.slot, styles.centre, { backgroundColor: ds.c.raised }]}>
                <Caption tone="muted">{`+${extra}`}</Caption>
              </View>
            );
          }
          return <View key={`empty-${i}`} style={[styles.slot, styles.empty, { borderColor: ds.c.lineStrong }]} />;
        })}
      </View>
      <View style={[styles.board, { backgroundColor: ds.c.lineStrong }]} />
    </View>
  );
}

/**
 * One step: its number, what it is, and Skip; once it has something, what's
 * there and a green count instead. Without `onPress` it can't be done yet.
 */
export function StepRow({ n, title, line, count, skipped, onPress, onSkip }: { n: number; title: string; line: string; count?: string | null; skipped?: boolean; onPress?: () => void; onSkip?: () => void }) {
  const ds = useDs();
  return (
    <View style={[styles.step, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <PressableScale
        role="button"
        disabled={!onPress}
        aria-disabled={!onPress}
        accessibilityLabel={[`${n}. ${title}`, line, count, skipped ? 'Skipped' : null].filter(Boolean).join(', ')}
        onPress={onPress}
        style={styles.stepMain}
      >
        <View style={[styles.num, { backgroundColor: ds.c.raised }]}>
          <Caption color={ds.accentText} style={styles.mono}>
            {String(n)}
          </Caption>
        </View>
        <View style={styles.flex}>
          <Body style={styles.strong} tone={onPress ? undefined : 'muted'}>
            {title}
          </Body>
          <Caption tone="muted">{line}</Caption>
        </View>
        {count ? (
          <View style={styles.count}>
            <IconSymbol name="checkmark" size={14} color={STATUS.success} />
            <Caption color={STATUS.success}>{count}</Caption>
          </View>
        ) : skipped ? (
          <Caption tone="muted">Skipped</Caption>
        ) : onPress ? (
          <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
        ) : null}
      </PressableScale>
      {onSkip && !count && !skipped ? <Button label="Skip" variant="ghost" size="sm" onPress={onSkip} accessibilityLabel={`Skip ${title.toLowerCase()}`} /> : null}
    </View>
  );
}

/** "Go deeper when you want": a plain link row to one of Venue settings' pages. */
export function DeeperRow({ title, line, onPress }: { title: string; line: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="link" accessibilityLabel={`${title}. ${line}`} onPress={onPress} style={[styles.deeper, { borderBottomColor: ds.c.line }]}>
      <View style={styles.flex}>
        <Body>{title}</Body>
        <Caption tone="muted">{line}</Caption>
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  shelf: { gap: space.md, paddingTop: space.md, paddingBottom: space.sm, paddingHorizontal: space.md, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  row: { gap: space.sm },
  slots: { flexDirection: 'row', gap: space.sm, justifyContent: 'center', flexWrap: 'wrap' },
  slot: { width: 44, height: 52, borderRadius: radius.control, borderCurve: 'continuous', overflow: 'hidden', justifyContent: 'flex-end' },
  empty: { borderWidth: 1.5, borderStyle: 'dashed' },
  centre: { alignItems: 'center', justifyContent: 'center' },
  board: { height: 4, borderRadius: radius.mark },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingRight: space.sm, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  stepMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingLeft: space.md, paddingRight: space.xs },
  num: { width: 30, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  mono: { fontFamily: fontFamilies.mono },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  flex: { flex: 1, minWidth: 0 },
  count: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  deeper: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth },
});
