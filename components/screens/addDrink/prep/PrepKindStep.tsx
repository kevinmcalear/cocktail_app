import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, Spec, useBreakpoint, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useMakingKit } from '@/hooks/useBarKit';
import { guessKind, keepsText, KIND_TILES, KIND_WAYS, PREP_KINDS, prepAmounts, tileOf, wayOf, waysByKit, type PrepDraft, type PrepKindId, type PrepWay } from '@/lib/prepKinds';
import { formatQuantity, toQuantity } from '@/lib/quantity';
import { techniqueById } from '@/lib/techniques';

import { EveryTechnique, TechniqueRow } from './EveryTechnique';

interface PrepKindStepProps {
  name: string;
  draft: PrepDraft;
  /** Two lines just combined: says it starts as Batch, and why the name may suggest another. */
  combined?: boolean;
  onKind: (kind: PrepKindId, way?: string) => void;
  onTechnique: (id: string) => void;
  /** "· change" on the amounts: the base's amount is set on the recipe step. */
  onChangeAmount: () => void;
}

/**
 * New prep, first step (make-anything-steps-1, step 4): what kind it is
 * (each with what goes in it, the one the name suggests marked), then
 * "How?". A syrup's or a shrub's ways are recipes (cold, hot, oleo); an
 * infusion's, a wash's, a clarified juice's and a distillate's are the
 * library's techniques, your kit first and the rest dimmed with I have this
 * (step 4, more to it). Something else, or Every technique, opens the whole
 * library. A way that fills the method says so. Under them, what the picked
 * way takes and how it keeps.
 */
export function PrepKindStep({ name, draft, combined, onKind, onTechnique, onChangeAmount }: PrepKindStepProps) {
  const ds = useDs();
  const { kit, where, add } = useMakingKit();
  const columns = useBreakpoint() === 'phone' ? 2 : 3;
  const guess = guessKind(name);
  const named = guess ? tileOf(guess) : null;
  // A technique the kinds don't list (a foam) is Something else.
  const picked = tileOf(draft.kind);
  const kindWays = KIND_WAYS[picked];
  // An infusion's, a wash's, a clarified juice's ways are techniques: kit first.
  const byKit = kindWays?.every((w) => w.fills) ? waysByKit(picked, kit) : null;
  // Every technique, opened from under a kind's ways; Something else always shows it.
  const [every, setEvery] = useState(false);
  const all = picked === 'other' || every;
  const way = wayOf(draft);
  const kitRow = (w: PrepWay) => {
    const t = techniqueById(w.technique);
    return t ? <TechniqueRow key={w.id} t={t} label={w.label} kit={kit} on={way?.id === w.id} onPress={() => onKind(picked, w.id)} onAdd={add} /> : null;
  };

  return (
    <View style={styles.stack}>
      <View role="radiogroup" accessibilityLabel="Kind of prep" style={styles.grid}>
        {KIND_TILES.map((id) => {
          const k = PREP_KINDS.find((x) => x.id === id)!;
          const on = k.id === picked;
          return (
            <PressableScale
              key={k.id}
              role="radio"
              aria-checked={on}
              accessibilityLabel={`${k.name}, ${k.ratio}${k.id === named ? ', from the name' : ''}`}
              onPress={() => {
                setEvery(false);
                onKind(k.id);
              }}
              // A short last row widens to fill it: the board's eight kinds leave no gap.
              style={[styles.kind, { flexBasis: `${100 / columns - 4}%`, flexGrow: 1, backgroundColor: ds.c.surface, borderColor: on ? ds.accentText : 'transparent' }]}
            >
              <View style={styles.row}>
                <Body>{k.name}</Body>
                {k.id === named ? <Caption tone="accent">from the name</Caption> : null}
              </View>
              <Caption tone="muted">{k.ratio}</Caption>
            </PressableScale>
          );
        })}
      </View>

      {kindWays && picked !== 'other' ? (
        <View style={styles.stack}>
          <Caption tone="muted">{byKit ? 'How? With your kit' : 'How?'}</Caption>
          {byKit ? <Caption tone="muted">{`Your kit is on ${where}. Ways it covers come first; the rest stay here, dimmed, in case you have the kit and haven’t added it.`}</Caption> : null}
          <View role="radiogroup" accessibilityLabel="Way to make it" style={styles.stack}>
            {byKit
              ? byKit.have.map(kitRow)
              : kindWays.map((w) => (
                  <WayRow
                    key={w.id}
                    name={w.name}
                    grade={techniqueById(w.technique)?.grade}
                    sub={[w.time, w.kit.join(', '), w.note].filter(Boolean).join(' · ')}
                    tip={w.tip}
                    on={way?.id === w.id}
                    onPress={() => onKind(picked, w.id)}
                  />
                ))}
            {byKit?.need.length ? <Caption tone="muted">Needs kit you haven’t added</Caption> : null}
            {byKit?.need.map(kitRow)}
          </View>
          {way?.fills ? <Caption tone="muted">{`${way.name} fills in the method: ${way.fills}.`}</Caption> : null}
          {byKit && !every ? (
            <PressableScale role="button" onPress={() => setEvery(true)} accessibilityLabel="Every technique" style={styles.all}>
              <Body tone="accent">Every technique</Body>
            </PressableScale>
          ) : null}
        </View>
      ) : null}
      {all ? (
        <View style={styles.stack}>
          <Caption tone="muted">{picked === 'other' ? 'Something else: every technique' : 'Every technique'}</Caption>
          <EveryTechnique name={name} selected={draft.technique ?? null} kit={kit} onPick={onTechnique} onAdd={add} onWrite={() => onKind('other')} />
        </View>
      ) : null}
      {combined ? <Caption tone="muted">Dropping two lines together starts as Batch. Naming it changes the suggestion; you pick.</Caption> : null}

      {draft.kind !== 'other' || draft.technique ? <Amounts draft={draft} how={way?.how ?? null} onChange={onChangeAmount} /> : null}
    </View>
  );
}

/** One way to make it: its name and grade, then time · kit · what it's like, and when to pick it. */
function WayRow({ name, grade, sub, tip, label, on, onPress }: { name: string; grade?: 'A' | 'B' | 'C'; sub: string; tip?: string; label?: string; on: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale
      role="radio"
      aria-checked={on}
      accessibilityLabel={[label ?? [name, sub, tip].filter(Boolean).join('. '), grade ? `How sure the sources are: ${grade}` : null].filter(Boolean).join('. ')}
      onPress={onPress}
      style={[styles.way, { backgroundColor: ds.c.raised, borderColor: on ? ds.accentText : 'transparent' }]}
    >
      <View style={styles.wayHead}>
        <Body style={styles.flex}>{name}</Body>
        {grade ? <GradeBadge grade={grade} /> : null}
      </View>
      {sub ? <Caption tone="muted">{sub}</Caption> : null}
      {tip ? <Caption tone="accent">{tip}</Caption> : null}
    </PressableScale>
  );
}

/** How sure the sources are, as the letter (canvas make-create-prep-kind); the row's label says it in words. */
function GradeBadge({ grade }: { grade: 'A' | 'B' | 'C' }) {
  const ds = useDs();
  return (
    <View aria-hidden style={[styles.grade, { borderColor: ds.c.lineStrong }]}>
      <DsText variant="caption" style={styles.mono}>
        {grade}
      </DsText>
    </View>
  );
}

/** "For 300 g pineapple · change", the rest of the amounts, how it's made and keeps, and All steps. */
function Amounts({ draft, how, onChange }: { draft: PrepDraft; how: string | null; onChange: () => void }) {
  const ds = useDs();
  const [steps, setSteps] = useState(false);
  const amounts = prepAmounts(draft).filter(({ line }) => !line.slot && line.name.trim());
  const say = ({ line, amount }: (typeof amounts)[number]) => {
    const q = amount !== null ? formatQuantity(toQuantity(amount, line.unit) ?? { kind: 'count', value: amount, unit: line.unit || 'each' }) : '';
    return q ? `${q} ${line.name.toLowerCase()}` : line.name.toLowerCase();
  };
  const base = amounts.find(({ line }) => line.key === draft.baseKey) ?? null;
  const rest = amounts.filter((a) => a !== base).map(say);
  const keeps = keepsText(draft);
  const cold = /fridge/i.test(draft.storage) ? ' cold' : /freezer/i.test(draft.storage) ? ' frozen' : '';
  const line = [how, keeps ? `Keeps about ${keeps}${cold}.` : null].filter(Boolean).join(' ');
  return (
    <View style={[styles.box, { borderColor: ds.c.line }]}>
      {base ? (
        <View style={styles.forRow}>
          <Caption tone="muted">FOR</Caption>
          <View style={styles.forAmount}>
            <Spec>{say(base)}</Spec>
            <PressableScale role="button" onPress={onChange} accessibilityLabel={`Change how much ${base.line.name.toLowerCase()}`} style={styles.change}>
              <Spec tone="muted">· change</Spec>
            </PressableScale>
          </View>
        </View>
      ) : null}
      {rest.length ? <Body>{rest.join(', ')}</Body> : null}
      {line ? <Caption tone="muted">{line}</Caption> : null}
      {draft.steps.length ? (
        <PressableScale role="button" aria-expanded={steps} onPress={() => setSteps(!steps)} accessibilityLabel={steps ? 'Hide the steps' : 'All steps'} style={styles.all}>
          <Body tone="accent">{steps ? 'Hide the steps' : 'All steps'}</Body>
        </PressableScale>
      ) : null}
      {steps
        ? draft.steps.map((s, i) => (
            <Caption key={`${i}:${s.body}`}>{`${i + 1}. ${s.body}`}</Caption>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'space-between' },
  kind: { minHeight: layout.minTapTarget + space.lg, borderRadius: radius.control, borderWidth: 2, paddingHorizontal: space.md - 2, paddingVertical: space.sm, justifyContent: 'center', gap: 2 },
  row: { flexDirection: 'row', alignItems: 'baseline', columnGap: space.sm, flexWrap: 'wrap' },
  flex: { flex: 1 },
  way: { gap: space.xs, paddingHorizontal: space.md, paddingVertical: space.md, borderRadius: radius.control, borderWidth: 2 },
  wayHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grade: { paddingHorizontal: space.xs + 2, borderRadius: radius.mark + 2, borderWidth: 1 },
  mono: { fontFamily: fontFamilies.monoMedium },
  box: { gap: space.xs, padding: space.md, borderRadius: radius.card, borderWidth: 1, marginTop: space.sm },
  forRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  forAmount: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  change: { minHeight: layout.minTapTarget, justifyContent: 'center', paddingLeft: space.xs },
  all: { minHeight: layout.minTapTarget, justifyContent: 'center', alignSelf: 'flex-start' },
});
