import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Chip, Field, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { timerFromText } from '@/lib/makeSteps';
import { keepsText, leadText, STORES, type PrepDraft } from '@/lib/prepKinds';
import { timerLabel } from '@/lib/scale';

interface StepRow {
  key: string;
  body: string;
  /** As typed: "10 min", "4 h", "1 day". */
  timer: string;
}
let rowKey = 0;
const row = (body: string, seconds: number | null): StepRow => ({ key: `r${rowKey++}`, body, timer: seconds ? (seconds === 86400 ? '1 day' : timerLabel(seconds)) : '' });

const KEEPS = [3 * 24, 7 * 24, 14 * 24, 28 * 24, 56 * 24, 26 * 7 * 24];
const LEADS = [20, 60, 24 * 60, 3 * 24 * 60, 7 * 24 * 60];

/**
 * New prep, the method: the kind's steps to change, add to or remove (a
 * timer in minutes on any of them), and how long it keeps, where, and how
 * far ahead to start it. A technique's own keep (5 minutes for an air, a
 * year for a tincture) and its safety notes come with it.
 */
export function PrepMethodStep({ draft, set }: { draft: PrepDraft; set: (change: Partial<PrepDraft>) => void }) {
  const ds = useDs();
  // Edited as words ("4 h"), saved as seconds; a bare number is minutes.
  const [steps, setSteps] = useState<StepRow[]>(() => draft.steps.map((s) => row(s.body, s.timer_seconds)));
  const changeSteps = (next: StepRow[]) => {
    setSteps(next);
    set({ steps: next.map((s) => ({ body: s.body, timer_seconds: timerFromText(/^\s*\d+\s*$/.test(s.timer) ? `${s.timer} min` : s.timer) })) });
  };
  const update = (key: string, patch: Partial<StepRow>) => changeSteps(steps.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const keeps = KEEPS.includes(draft.keepsHours ?? -1) || draft.keepsHours === null ? KEEPS : [...KEEPS, draft.keepsHours].sort((a, b) => a - b);
  const stores: string[] = STORES.includes(draft.storage as (typeof STORES)[number]) || !draft.storage ? [...STORES] : [...STORES, draft.storage];
  const leads = LEADS.includes(draft.leadMinutes ?? -1) || draft.leadMinutes === null ? LEADS : [...LEADS, draft.leadMinutes].sort((a, b) => a - b);

  return (
    <View style={styles.stack}>
      {draft.watch?.length ? (
        <View style={[styles.watch, { backgroundColor: ds.c.raised }]}>
          <Caption tone={draft.gate ? 'accent' : 'muted'}>{draft.gate === 'legal' ? 'Check the law first' : draft.gate === 'safety' ? 'Safety first' : 'Watch for'}</Caption>
          {draft.watch.map((w) => (
            <Caption key={w}>{w}</Caption>
          ))}
        </View>
      ) : null}
      <View style={styles.steps}>
        {steps.map((s, i) => (
          <View key={s.key} style={[styles.step, { borderBottomColor: ds.c.line }]}>
            <View style={[styles.number, { backgroundColor: ds.c.raised }]}>
              <Caption>{String(i + 1)}</Caption>
            </View>
            <View style={styles.fields}>
              <Field label={`Step ${i + 1}`} hideLabel value={s.body} onChangeText={(body) => update(s.key, { body })} placeholder="What to do" multiline />
              <View style={styles.timerRow}>
                <View style={styles.timer}>
                  <Field label={`Timer for step ${i + 1}`} hideLabel value={s.timer} onChangeText={(timer) => update(s.key, { timer })} placeholder="Timer: 10 min, 4 h, 1 day" />
                </View>
                <PressableScale accessibilityLabel={`Remove step ${i + 1}`} onPress={() => changeSteps(steps.filter((x) => x.key !== s.key))} style={styles.remove}>
                  <IconSymbol name="trash" size={18} color={ds.c.muted} />
                </PressableScale>
              </View>
            </View>
          </View>
        ))}
        <Button label="Add a step" variant="secondary" icon="plus" onPress={() => changeSteps([...steps, row('', null)])} style={styles.add} />
      </View>
      <Group label="Keeps">
        {draft.keepsMinutes ? <Chip label={keepsText({ keepsHours: null, keepsMinutes: draft.keepsMinutes }) ?? ''} selected onPress={() => set({ keepsMinutes: null })} /> : null}
        {keeps.map((h) => (
          <Chip key={h} label={keepsText({ keepsHours: h }) ?? ''} selected={draft.keepsHours === h} onPress={() => set({ keepsHours: draft.keepsHours === h ? null : h, keepsMinutes: null })} />
        ))}
      </Group>
      <Group label="Store">
        {stores.map((s) => (
          <Chip key={s} label={s} selected={draft.storage === s} onPress={() => set({ storage: s })} />
        ))}
      </Group>
      <Group label="Start">
        {leads.map((m) => (
          <Chip key={m} label={leadText(m) ?? ''} selected={draft.leadMinutes === m} onPress={() => set({ leadMinutes: draft.leadMinutes === m ? null : m })} />
        ))}
      </Group>
      <Caption tone="muted">Filled in for this kind. They’re starting points: change them to what works at your bar.</Caption>
    </View>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Caption tone="muted">{label}</Caption>
      <View role="radiogroup" accessibilityLabel={label} style={styles.chips}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  steps: { gap: space.sm },
  step: { flexDirection: 'row', gap: space.md, paddingBottom: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  number: { width: 26, height: 26, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
  fields: { flex: 1, gap: space.xs },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  timer: { flex: 1 },
  remove: { minWidth: layout.minTapTarget, minHeight: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  add: { alignSelf: 'flex-start' },
  group: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  watch: { borderRadius: radius.control, padding: space.md, gap: space.xs },
});
