import { StyleSheet, View } from 'react-native';

import { Caption, DateField, DsText, TimeField, useDs } from '@/components/ds';
import { displayFaces, fontFamilies, radius, space } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import type { PlanDraft } from '@/lib/menus';

import { Choice } from './MenuSheet';

/** The pencil lines standing in for drinks on the draft sheet, as wide as drawn (of 122). */
const LINES = [90, 70, 84, 60, 78];

/**
 * The menu being made, as a tilted portrait sheet of paper in a cream panel:
 * its name in the display face, a short rule, pencil lines standing in for
 * drinks, and in the panel's corner what it starts from (and when) in mono.
 */
export function DraftCard({ name, lines }: { name: string; lines: (string | null)[] }) {
  const ds = useDs();
  const shown = lines.filter((l): l is string => !!l);
  return (
    <View style={[styles.panel, { backgroundColor: ds.c.paper }]}>
      <View style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.sketchInk }]}>
        <DsText variant="headline" align="center" numberOfLines={2} color={ds.c.ink} style={{ fontFamily: displayFaces[ds.displayFace].regular }}>
          {name}
        </DsText>
        <View style={[styles.rule, { backgroundColor: ds.c.sketchInk }]} />
        {LINES.map((w, i) => (
          <View key={i} style={[styles.line, { width: w, backgroundColor: withAlpha(ds.c.sketchInk, 0.35) }]} />
        ))}
      </View>
      <Caption color={ds.c.sketchInk} style={[styles.mono, styles.panelCaption]}>
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
  panel: { alignSelf: 'stretch', alignItems: 'center', gap: space.sm, padding: space.lg, borderRadius: radius.card, borderCurve: 'continuous' },
  card: { width: 150, height: 170, borderRadius: radius.mark, borderWidth: 2, paddingVertical: space.lg, paddingHorizontal: space.md + 2, alignItems: 'center', gap: space.sm, marginTop: space.xs, transform: [{ rotate: '-2deg' }] },
  panelCaption: { alignSelf: 'stretch' },
  rule: { width: 28, height: 1 },
  line: { height: 2 },
  list: { gap: space.sm },
  track: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  bar: { flex: 1, height: 4, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: 4, borderRadius: radius.pill },
  mono: { fontFamily: fontFamilies.monoMedium },
});
