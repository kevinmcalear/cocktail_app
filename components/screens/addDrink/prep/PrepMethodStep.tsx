import { useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Body, Button, Caption, Chip, Field, PressableScale, useDs } from '@/components/ds';
import { dragGripStyle } from '@/components/recipe/FormScrollContainer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { dropIndex } from '@/lib/dropIndex';
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
/** The grip column: only a touch there starts a drag, so the page still scrolls over the steps. */
const GRIP = layout.minTapTarget;
/** On a touch screen a drag starts after a short hold, so a swipe over the grip still scrolls. */
const HOLD_MS = Platform.OS === 'web' ? 0 : 200;

type Tile = 'keeps' | 'store' | 'start';

/**
 * New prep, the method: the steps as text rows, each led by a numbered grip
 * (drag it, or arrow keys on the web, to move the step) with its timer as a
 * pill. Tap a step to change it; a time written in it ("for 2 hours")
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
  const move = (from: number, to: number) => {
    if (to < 0 || to >= steps.length) return;
    const next = [...steps];
    const [s] = next.splice(from, 1);
    next.splice(to, 0, s);
    changeSteps(next);
  };
  const keeps = KEEPS.includes(draft.keepsHours ?? -1) || draft.keepsHours === null ? KEEPS : [...KEEPS, draft.keepsHours].sort((a, b) => a - b);
  const stores: string[] = STORES.includes(draft.storage as (typeof STORES)[number]) || !draft.storage ? [...STORES] : [...STORES, draft.storage];
  const leads = LEADS.includes(draft.leadMinutes ?? -1) || draft.leadMinutes === null ? LEADS : [...LEADS, draft.leadMinutes].sort((a, b) => a - b);
  const keepsNow = keepsText(draft);

  // Each row's height, for where a dragged step lands.
  const heights = useRef<Record<string, number>>({});
  const drop = (from: number, dy: number) => move(from, dropIndex(from, dy, steps.map((x) => heights.current[x.key] ?? 0)));

  const renderStep = (s: StepRow, i: number) => (
    <DragRow key={s.key} index={i} onDrop={drop} onHeight={(h) => (heights.current[s.key] = h)}>
      {(grip, isActive) => (
        <View role="listitem" style={[styles.step, { borderBottomColor: ds.c.line, backgroundColor: isActive ? ds.c.raised : ds.c.ground }]}>
          {grip(
            <PressableScale
              role="button"
              accessibilityLabel={`Move step ${i + 1}. Drag, or use the arrow keys`}
              // @ts-expect-error onKeyDown is web-only (react-native-web)
              onKeyDown={(e: { key: string; preventDefault: () => void }) => {
                const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : null;
                if (to === null) return;
                e.preventDefault();
                move(i, to);
              }}
              style={[styles.grip, dragGripStyle]}
            >
              <View style={[styles.number, { backgroundColor: ds.c.raised }]}>
                <Caption>{String(i + 1)}</Caption>
              </View>
            </PressableScale>
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
                  <View style={[styles.pill, { backgroundColor: ds.c.raised }]}>
                    <Caption>{pill(s.timer)}</Caption>
                  </View>
                ) : null}
              </PressableScale>
            )}
          </View>
        </View>
      )}
    </DragRow>
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
      <View role="list" aria-label="Steps">
        {steps.map(renderStep)}
      </View>
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

/**
 * A step that can be dragged by its grip: it follows the finger, lifted
 * over the others, and lands where it's let go (lib/dropIndex). Plain
 * transforms, no layout animations: those crash Reanimated 4 when the
 * builder closes (as in #298).
 */
function DragRow({ index, onDrop, onHeight, children }: { index: number; onDrop: (from: number, dy: number) => void; onHeight: (h: number) => void; children: (grip: (node: ReactNode) => ReactNode, active: boolean) => ReactNode }) {
  const y = useSharedValue(0);
  const lifted = useSharedValue(0);
  const [active, setActive] = useState(false);
  const pan = Gesture.Pan()
    .activateAfterLongPress(HOLD_MS)
    .onStart(() => {
      lifted.set(1);
      scheduleOnRN(setActive, true);
    })
    .onUpdate((e) => {
      y.set(e.translationY);
    })
    .onEnd((e) => {
      scheduleOnRN(onDrop, index, e.translationY);
    })
    .onFinalize(() => {
      y.set(0);
      lifted.set(0);
      scheduleOnRN(setActive, false);
    });
  const follow = useAnimatedStyle(() => ({ zIndex: lifted.get() ? 1 : 0, transform: [{ translateY: y.get() }] }));
  return (
    <Animated.View style={follow} onLayout={(e) => onHeight(e.nativeEvent.layout.height)}>
      {children((node) => <GestureDetector gesture={pan}>{node}</GestureDetector>, active)}
    </Animated.View>
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
  grip: { width: GRIP, minHeight: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  number: { width: 26, height: 26, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  text: { minHeight: layout.minTapTarget, justifyContent: 'center', gap: space.xs, paddingVertical: space.xs },
  pill: { alignSelf: 'flex-start', paddingHorizontal: space.sm, borderRadius: radius.pill },
  editing: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  remove: { minWidth: layout.minTapTarget, minHeight: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  add: { alignSelf: 'flex-start' },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, gap: 2, padding: space.md, borderRadius: radius.control, borderWidth: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  watch: { borderRadius: radius.control, padding: space.md, gap: space.xs },
});
