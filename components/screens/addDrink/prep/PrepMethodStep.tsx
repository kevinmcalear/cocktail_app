import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, PressableScale, useDs } from '@/components/ds';
import { DragGrip, DragList, type DragRowState } from '@/components/ds/DragList';
import type { GlyphName } from '@/components/ui/glyphs';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { font, layout, radius, space } from '@/constants/tokens';
import { timerFromText } from '@/lib/makeSteps';
import { keepsText, leadText, STORES, type PrepDraft } from '@/lib/prepKinds';
import { timerLabel } from '@/lib/scale';

interface StepRow {
  key: string;
  body: string;
  timer: number | null;
}
let rowKey = 0;
const row = (body: string, timer: number | null): StepRow => ({ key: `r${rowKey++}`, body, timer });
const DAY = 86400;
/** "1 day", "2 h", "20 min": a step's timer pill. */
const pill = (seconds: number) => (seconds >= DAY && seconds % DAY === 0 ? `${seconds / DAY} ${seconds === DAY ? 'day' : 'days'}` : timerLabel(seconds));

const KEEPS = [3 * 24, 7 * 24, 14 * 24, 21 * 24, 28 * 24, 56 * 24, 26 * 7 * 24];
const LEADS = [20, 60, 24 * 60, 2 * 24 * 60, 3 * 24 * 60, 7 * 24 * 60];

type Tile = 'keeps' | 'store' | 'start';

/** Steps to start from (make-anything-steps-2, step 6). No temperature or time: those are the maker's to write. */
const STARTERS: { label: string; icon: GlyphName; body: string }[] = [
  { label: 'Mix', icon: 'arrow.clockwise', body: 'Mix everything together.' },
  { label: 'Sous vide', icon: 'thermometer.medium', body: 'Seal it in a bag and hold it in a water bath.' },
  { label: 'Infuse', icon: 'leaf.fill', body: 'Leave it to infuse, tasting now and then.' },
  { label: 'Rest', icon: 'clock', body: 'Let it rest.' },
  { label: 'Strain', icon: 'line.3.horizontal.decrease', body: 'Strain through a fine sieve.' },
  { label: 'Chill', icon: 'snowflake', body: 'Chill it.' },
  { label: 'Bottle', icon: 'flask', body: 'Bottle it and write the date on it.' },
];

/**
 * New prep, the method: steps to start from (Mix, Sous vide, Strain), then
 * the steps as text rows, each led by its grip (dots and number: drag it, or
 * arrow keys on the web, to move the step) with its timer as a pill with a
 * clock. Tap a step to change it; a time written in it ("for 2 hours")
 * becomes its timer. Then Keeps, Store and Start as three tiles, suggested
 * for the kind: tap one for its choices. A technique's safety notes come first.
 */
export function PrepMethodStep({ draft, set, phrase }: { draft: PrepDraft; set: (change: Partial<PrepDraft>) => void; phrase: string | null }) {
  const ds = useDs();
  const [steps, setSteps] = useState<StepRow[]>(() => draft.steps.map((s) => row(s.body, s.timer_seconds)));
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState<Tile | null>(null);
  const changeSteps = (next: StepRow[]) => {
    setSteps(next);
    set({ steps: next.filter((s) => s.body.trim()).map((s) => ({ body: s.body, timer_seconds: s.timer })) });
  };
  const write = (key: string, body: string) => changeSteps(steps.map((s) => (s.key === key ? { ...s, body, timer: timerFromText(body) ?? s.timer } : s)));
  const keeps = KEEPS.includes(draft.keepsHours ?? -1) || draft.keepsHours === null ? KEEPS : [...KEEPS, draft.keepsHours].sort((a, b) => a - b);
  const stores: string[] = STORES.includes(draft.storage as (typeof STORES)[number]) || !draft.storage ? [...STORES] : [...STORES, draft.storage];
  const leads = LEADS.includes(draft.leadMinutes ?? -1) || draft.leadMinutes === null ? LEADS : [...LEADS, draft.leadMinutes].sort((a, b) => a - b);
  const keepsNow = keepsText(draft);

  const renderStep = (s: StepRow, { index: i, lifted, grip, move }: DragRowState) => (
    <View style={[styles.step, { borderBottomColor: ds.c.line }]}>
      {grip(
        <DragGrip name={`step ${i + 1}`} label={`Move step ${i + 1}`} onMove={move} lifted={lifted}>
          <View style={[styles.number, { backgroundColor: ds.c.raised }]}>
            <Caption>{String(i + 1)}</Caption>
          </View>
        </DragGrip>
      )}
      <View style={styles.flex}>
        {editing === s.key ? (
          <View style={styles.editing}>
            <View style={styles.flex}>
              <Field label={`Step ${i + 1}`} hideLabel value={s.body} onChangeText={(body) => write(s.key, body)} placeholder="What to do" multiline autoFocus />
            </View>
            <PressableScale accessibilityLabel={`Done with step ${i + 1}`} onPress={() => setEditing(null)} style={styles.remove}>
              <IconSymbol name="checkmark" size={18} color={ds.c.ink} />
            </PressableScale>
            <PressableScale accessibilityLabel={`Remove step ${i + 1}`} onPress={() => changeSteps(steps.filter((x) => x.key !== s.key))} style={styles.remove}>
              <IconSymbol name="trash" size={18} color={ds.c.muted} />
            </PressableScale>
          </View>
        ) : (
          <PressableScale role="button" accessibilityLabel={`Step ${i + 1}: ${s.body || 'empty'}. Change it`} onPress={() => setEditing(s.key)} style={styles.text}>
            <Body tone={s.body ? 'ink' : 'muted'}>{s.body || 'What to do'}</Body>
            {s.timer ? (
              <View style={[styles.pill, { borderColor: ds.c.lineStrong }]}>
                <IconSymbol name="clock" size={13} color={ds.c.ink} />
                <Caption style={styles.pillText}>{pill(s.timer)}</Caption>
              </View>
            ) : null}
          </PressableScale>
        )}
      </View>
    </View>
  );

  const tiles: { id: Tile; label: string; value: string }[] = [
    { id: 'keeps', label: 'Keeps', value: keepsNow ? `About ${keepsNow}` : 'Not set' },
    { id: 'store', label: 'Store', value: draft.storage ? draft.storage.split(',')[0] : 'Not set' },
    { id: 'start', label: 'Start', value: leadText(draft.leadMinutes)?.replace(/^Start /, '') ?? 'Not set' },
  ];

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
      <View role="group" aria-label="Start from a step" style={styles.chips}>
        {STARTERS.map((st) => (
          <PressableScale
            key={st.label}
            role="button"
            accessibilityLabel={`Add a step: ${st.label}`}
            onPress={() => {
              const s = row(st.body, timerFromText(st.body));
              changeSteps([...steps, s]);
              setEditing(s.key);
            }}
            style={[styles.starter, { borderColor: ds.c.lineStrong }]}
          >
            <IconSymbol name={st.icon} size={14} color={ds.c.ink} />
            <Caption>{st.label}</Caption>
          </PressableScale>
        ))}
      </View>
      <DragList label="Steps" data={steps} keyOf={(x) => x.key} onReorder={changeSteps} renderRow={renderStep} />
      <Button
        label="Add a step"
        variant="secondary"
        icon="plus"
        onPress={() => {
          const s = row('', null);
          setSteps([...steps, s]);
          setEditing(s.key);
        }}
        style={styles.add}
      />
      <View style={styles.tiles}>
        {tiles.map((t) => (
          <PressableScale
            key={t.id}
            role="button"
            aria-expanded={open === t.id}
            accessibilityLabel={`${t.label}: ${t.value}. Change it`}
            onPress={() => setOpen(open === t.id ? null : t.id)}
            style={[styles.tile, { backgroundColor: ds.c.raised, borderColor: open === t.id ? ds.accentText : 'transparent' }]}
          >
            <Caption tone="muted">{t.label}</Caption>
            <Body numberOfLines={2}>{t.value}</Body>
          </PressableScale>
        ))}
      </View>
      {open === 'keeps' ? (
        <Choices label="Keeps">
          {draft.keepsMinutes ? <Chip label={keepsText({ keepsHours: null, keepsMinutes: draft.keepsMinutes }) ?? ''} selected onPress={() => set({ keepsMinutes: null })} /> : null}
          {keeps.map((h) => (
            <Chip key={h} label={keepsText({ keepsHours: h }) ?? ''} selected={draft.keepsHours === h} onPress={() => set({ keepsHours: draft.keepsHours === h ? null : h, keepsMinutes: null })} />
          ))}
        </Choices>
      ) : open === 'store' ? (
        <Choices label="Store">
          {stores.map((s) => (
            <Chip key={s} label={s} selected={draft.storage === s} onPress={() => set({ storage: s })} />
          ))}
        </Choices>
      ) : open === 'start' ? (
        <Choices label="Start">
          {leads.map((m) => (
            <Chip key={m} label={leadText(m) ?? ''} selected={draft.leadMinutes === m} onPress={() => set({ leadMinutes: draft.leadMinutes === m ? null : m })} />
          ))}
        </Choices>
      ) : null}
      <Caption tone="muted">{`Suggested for ${phrase ?? 'this kind'}. Tap one to change it.`}</Caption>
    </View>
  );
}

function Choices({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View role="radiogroup" accessibilityLabel={label} style={styles.chips}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  number: { width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  text: { minHeight: layout.minTapTarget, justifyContent: 'center', gap: space.xs, paddingVertical: space.xs },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, minHeight: 30, paddingHorizontal: space.md - 2, marginTop: space.xs, borderRadius: radius.pill, borderWidth: 1 },
  pillText: { ...font.semiBold },
  editing: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  remove: { minWidth: layout.minTapTarget, minHeight: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  add: { alignSelf: 'flex-start' },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, gap: 2, padding: space.md, borderRadius: radius.control, borderWidth: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  starter: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2, minHeight: layout.minTapTarget - 8, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1 },
  watch: { borderRadius: radius.control, padding: space.md, gap: space.xs },
});
