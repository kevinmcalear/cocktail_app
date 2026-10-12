import { StyleSheet, View } from 'react-native';

import { Caption, DateField, DsText, TimeField, useDs } from '@/components/ds';
import { displayFaces, fontFamilies, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import type { PlanDraft } from '@/lib/menus';

import { Choice } from './MenuSheet';

/**
 * The menu being made, as a small tilted paper menu: its name in the display
 * face, a short rule, lines standing in for drinks, and under it what it
 * starts from (and when) on the right.
 */
export function DraftCard({ name, lines }: { name: string; lines: (string | null)[] }) {
  const ds = useDs();
  const shown = lines.filter((l): l is string => !!l);
  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: ds.c.paper, borderColor: ds.c.line }]}>
        <DsText variant="headline" align="center" numberOfLines={2} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {name}
        </DsText>
        <View style={[styles.rule, { backgroundColor: ds.c.lineStrong }]} />
        {[0.8, 0.6, 0.7].map((w, i) => (
          <View key={i} style={[styles.line, { width: `${w * 100}%`, backgroundColor: withAlpha(ds.c.ink, 0.12) }]} />
        ))}
      </View>
      <Caption tone="muted" align="right">
        {shown.length ? shown.join(' · ') : 'Fills in as you go'}
      </Caption>
    </View>
  );
}

/** "2 of 3" with a bar, like the add-drink wizard's. */
export function StepTrack({ at, of }: { at: number; of: number }) {
  const ds = useDs();
  return (
    <View style={styles.track}>
      <View
        role="progressbar"
        accessibilityLabel="Progress"
        aria-valuemin={0}
        aria-valuemax={of}
        aria-valuenow={at + 1}
        style={[styles.bar, { backgroundColor: withAlpha(ds.c.ink, 0.15) }]}
      >
        <View style={[styles.fill, { backgroundColor: ds.c.ink, width: `${((at + 1) / of) * 100}%` }]} />
      </View>
      <Caption tone="muted" style={styles.mono}>{`${at + 1} of ${of}`}</Caption>
    </View>
  );
}

/** A venue menu's dates: a run from a day, one night from a time, or not yet. Saved as a plan; Go live puts it on. */
export function VenueDatesFields({ value, onChange, min }: { value: PlanDraft; onChange: (next: PlanDraft) => void; min: string }) {
  const set = (patch: Partial<PlanDraft>) => onChange({ ...value, ...patch });
  return (
    <>
      <View role="radiogroup" accessibilityLabel="When" style={styles.list}>
        <Choice label="From a date" detail="A menu that runs until the next one." icon="calendar" selected={value.kind === 'run'} onPress={() => set({ kind: 'run' })} />
        <Choice label="One night" detail="Halloween, a takeover: one night, then it's done." icon="sparkles" selected={value.kind === 'night'} onPress={() => set({ kind: 'night' })} />
        <Choice label="Not yet" detail="Pick the dates when it goes live." icon="clock" selected={value.kind === 'none'} onPress={() => set({ kind: 'none' })} />
      </View>
      {value.kind !== 'none' ? <DateField label={value.kind === 'night' ? 'Night' : 'Starts'} value={value.date} onChange={(date) => set({ date })} min={min} /> : null}
      {value.kind === 'night' ? <TimeField label="From" value={value.time} onChange={(time) => set({ time })} /> : null}
      <Caption tone="muted">It stays a draft until it goes live. A one-night menu can be shared before then.</Caption>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs, alignSelf: 'center', width: 220 },
  card: { borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth, paddingVertical: space.lg, paddingHorizontal: space.lg, alignItems: 'center', gap: space.xs, transform: [{ rotate: '-2deg' }] },
  rule: { width: 32, height: 1, marginVertical: space.xs },
  line: { height: 6, borderRadius: radius.pill },
  list: { gap: space.sm },
  track: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  bar: { flex: 1, height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 4, borderRadius: radius.pill },
  mono: { fontFamily: fontFamilies.monoMedium },
});
