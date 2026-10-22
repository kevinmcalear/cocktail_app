import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { GlassThumb } from '@/components/glass/GlassModelPicker';
import { SetupChromeProvider, useSetupChrome } from '@/components/screens/onboarding/SetupPage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import type { SketchGlass } from '@/lib/sketch/types';
import { stepProgress, type WhatNextStep } from '@/lib/whatNext';

/** A page inside What next: setup's chrome with its own title, Back and "1 of 2 · Glasses". */
export function StepChrome({ title, intro, step, onBack, children }: { title: string; intro?: string; step?: WhatNextStep; onBack: () => void; children: ReactNode }) {
  const base = useSetupChrome();
  if (!base) return children;
  return (
    <SetupChromeProvider value={{ ...base, title, intro, noBack: false, mark: undefined, eyebrow: null, onBack, progress: step ? stepProgress(step) : null }}>
      {children}
    </SetupChromeProvider>
  );
}

const GLASS_SLOTS = 4;
const BOTTLE_SLOTS = 6;

/** A spot on the shelf: a drawing on paper, or dashed and empty. */
function Slot({ children }: { children?: ReactNode }) {
  const ds = useDs();
  return children ? (
    <View style={[styles.slot, { backgroundColor: ds.c.paper }]}>{children}</View>
  ) : (
    <View style={[styles.slot, styles.empty, { borderColor: ds.c.lineStrong }]} />
  );
}

/**
 * The bar's back bar, drawn: a shelf of glasses over a shelf of bottles, with
 * empty spots that fill with the real drawing of each one the bar picks.
 */
export function BarDrawing({ name, glasses, bottles }: { name: string; glasses: { id: string; glass: SketchGlass; variant: string | null }[]; bottles: { id: string; name: string }[] }) {
  const ds = useDs();
  const shelf = <View style={[styles.plank, { backgroundColor: ds.c.lineStrong }]} />;
  const empty = (n: number, have: number) => Array.from({ length: Math.max(0, n - have) }, (_, i) => <Slot key={`empty-${i}`} />);
  return (
    <View
      role="img"
      aria-label={`${name}’s back bar, drawn: ${glasses.length} ${glasses.length === 1 ? 'glass' : 'glasses'} and ${bottles.length} ${bottles.length === 1 ? 'bottle' : 'bottles'} so far`}
      style={[styles.drawing, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}
    >
      <View style={styles.row} aria-hidden>
        {glasses.slice(0, GLASS_SLOTS * 2).map((g) => (
          <Slot key={g.id}>
            <GlassThumb glass={g.glass} variant={g.variant} size={44} />
          </Slot>
        ))}
        {empty(GLASS_SLOTS, glasses.length)}
      </View>
      {shelf}
      <View style={styles.row} aria-hidden>
        {bottles.slice(0, BOTTLE_SLOTS * 2).map((b) => (
          <Slot key={b.id}>
            <IngredientThumb id={b.id} name={b.name} size={44} />
          </Slot>
        ))}
        {empty(BOTTLE_SLOTS, bottles.length)}
      </View>
      {shelf}
    </View>
  );
}

/** One of What next's steps: its number, what it is, and Skip; once done, a check and how many. */
export function StepRow({ at, title, line, done, onPress, onSkip }: { at: number; title: string; line: string; done?: string | null; onPress: () => void; onSkip?: () => void }) {
  const ds = useDs();
  return (
    <View style={[styles.step, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <PressableScale role="button" accessibilityLabel={`${title}. ${line}${done ? `. ${done} so far` : ''}`} onPress={onPress} style={styles.stepMain}>
        <View style={[styles.number, { backgroundColor: ds.c.raised }]}>
          <DsText variant="caption" color={ds.accentText} style={styles.mono}>
            {String(at)}
          </DsText>
        </View>
        <View style={styles.flex}>
          <Body style={styles.strong}>{title}</Body>
          <Caption tone="muted" numberOfLines={1}>
            {line}
          </Caption>
        </View>
        {done ? (
          <View style={styles.count}>
            <IconSymbol name="checkmark" size={14} color={ds.accentText} />
            <Caption color={ds.accentText}>{done}</Caption>
          </View>
        ) : (
          <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
        )}
      </PressableScale>
      {onSkip && !done ? (
        <PressableScale role="button" accessibilityLabel={`Skip ${title.toLowerCase()}`} onPress={onSkip} style={styles.skip}>
          <Body tone="muted">Skip</Body>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** A quieter way further in, under "Go deeper when you want". */
export function DeeperRow({ title, line, onPress }: { title: string; line: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel={`${title}. ${line}`} onPress={onPress} style={[styles.deeper, { borderBottomColor: ds.c.line }]}>
      <View style={styles.flex}>
        <Body>{title}</Body>
        <Caption tone="muted">{line}</Caption>
      </View>
      <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  drawing: { gap: space.sm, paddingTop: space.md, paddingHorizontal: space.md, paddingBottom: space.sm, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  plank: { height: space.xs, borderRadius: radius.mark },
  slot: { width: 44, height: 52, borderRadius: radius.control, borderCurve: 'continuous', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  empty: { borderWidth: 1.5, borderStyle: 'dashed' },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingRight: space.sm, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1 },
  stepMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingLeft: space.md, paddingRight: space.xs },
  number: { width: 30, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  mono: { fontFamily: fontFamilies.mono },
  skip: { minHeight: layout.minTapTarget, justifyContent: 'center', paddingHorizontal: space.xs },
  count: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  deeper: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + space.sm, paddingVertical: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
});
