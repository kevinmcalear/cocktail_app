import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, PressableScale, Spec, useBreakpoint, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { useKit } from '@/hooks/useKit';
import { guessKind, keepsText, KIND_TILES, KIND_WAYS, PREP_KINDS, prepAmounts, tileOf, wayOf, type PrepDraft, type PrepKindId } from '@/lib/prepKinds';
import { formatQuantity, toQuantity } from '@/lib/quantity';
import { equipmentById, missingKit, techniqueById } from '@/lib/techniques';
import { waysToMake } from '@/lib/techniques/makeIt';

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
 * "How?": the kind's ways (an infusion cold, sous vide or by nitrous; a
 * shrub cold, hot or as an oleo shrub) or, for a name a library technique
 * makes ("Clarified grapefruit"), those techniques, each with its time, kit
 * and how sure the sources are. A way that fills the method says so. Under
 * them, what the picked way takes and how it keeps.
 */
export function PrepKindStep({ name, draft, combined, onKind, onTechnique, onChangeAmount }: PrepKindStepProps) {
  const ds = useDs();
  const { kit } = useKit();
  const columns = useBreakpoint() === 'phone' ? 2 : 3;
  const guess = guessKind(name);
  const named = guess ? tileOf(guess) : null;
  // A technique the kinds don't list (a clarified juice) lights no kind.
  const picked = draft.technique && !wayOf(draft) ? null : tileOf(draft.kind);
  const kindWays = picked ? KIND_WAYS[picked] : undefined;
  const techniques = kindWays ? [] : waysToMake(name);
  const way = wayOf(draft);

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
              onPress={() => onKind(k.id)}
              style={[styles.kind, { width: `${100 / columns - 2}%`, backgroundColor: ds.c.surface, borderColor: on ? ds.accentText : 'transparent' }]}
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

      {kindWays || techniques.length ? (
        <View style={styles.stack}>
          <Caption tone="muted">How?</Caption>
          <View role="radiogroup" accessibilityLabel="Way to make it" style={styles.stack}>
            {kindWays?.map((w) => (
              <WayRow
                key={w.id}
                name={w.name}
                grade={techniqueById(w.technique)?.grade}
                sub={[w.time, w.kit.join(', '), w.note].filter(Boolean).join(' · ')}
                tip={w.tip}
                on={way?.id === w.id}
                onPress={() => onKind(picked!, w.id)}
              />
            ))}
            {techniques.map((t) => {
              const missing = kit.size ? missingKit(t, kit) : [];
              const tools = t.equipment.map((id) => equipmentById(id)?.name ?? id);
              return (
                <WayRow
                  key={t.id}
                  name={t.name}
                  grade={t.grade}
                  sub={[t.time, tools.join(', ')].filter(Boolean).join(' · ')}
                  tip={missing.length ? `Needs ${missing.join(', ')}` : undefined}
                  label={`${t.name}. ${t.summary} ${t.time}`}
                  on={draft.technique === t.id}
                  onPress={() => onTechnique(t.id)}
                />
              );
            })}
          </View>
          {way?.fills ? <Caption tone="muted">{`${way.name} fills in the method: ${way.fills}.`}</Caption> : null}
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
