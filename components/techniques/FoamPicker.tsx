import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Button, Caption, PressableScale, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { baseHasFat, pickFoam, type Diet, type FoamAgent, type FoamKind, type FoamQuestion } from '@/lib/techniques/foamPicker';

import { gradeLabel, Section } from './bits';

const KINDS: { value: FoamKind; label: string }[] = [
  { value: 'shaken', label: 'Shaken cap' },
  { value: 'siphon', label: 'Siphon' },
  { value: 'air', label: 'Light air' },
];
const DIETS: { value: Diet; label: string }[] = [
  { value: 'none', label: 'Nobody' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'no-egg', label: 'No egg' },
  { value: 'no-soy', label: 'No soy' },
];

/** One question: its answers as full-width segments, the pick filled (prep-tech-foam). */
function Choice<T extends string | boolean>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const ds = useDs();
  return (
    <View role="radiogroup" aria-label={label} style={styles.question}>
      <Caption tone="muted" style={styles.eyebrow}>{label.toUpperCase()}</Caption>
      <View style={styles.segments}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <PressableScale
              key={String(o.value)}
              role="radio"
              aria-checked={on}
              accessibilityLabel={o.label}
              onPress={() => onChange(o.value)}
              style={[styles.segment, { backgroundColor: on ? ds.c.ink : 'transparent', borderColor: on ? ds.c.ink : ds.c.lineStrong }]}
            >
              <Body color={on ? ds.c.ground : ds.c.ink} align="center" style={styles.medium}>
                {o.label}
              </Body>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

interface FoamPickerProps {
  /** Asked from a drink's spec: the kind is a shaken head, so that question is skipped. */
  kind?: FoamKind;
  /** Start from what the spec already says (a vegan drink). */
  diet?: Diet;
  /** Adds the agent to the spec; agents without a per-drink amount open their technique instead. */
  onUse?: (agent: FoamAgent) => void;
}

/** Foam from anything: kind, fat, strength and diet narrow the foamers to one to start with, and say why the rest are out. */
export function FoamPicker({ kind, diet = 'none', onUse }: FoamPickerProps) {
  const ds = useDs();
  const [q, setQ] = useState<FoamQuestion>({ kind: kind ?? 'shaken', fat: false, strong: false, diet });
  const [base, setBase] = useState('');
  const set = <K extends keyof FoamQuestion>(k: K) => (v: FoamQuestion[K]) => setQ((s) => ({ ...s, [k]: v }));
  const answer = pickFoam(q);

  return (
    <View style={styles.stack}>
      {/* The base inline in its field, its label at the left. */}
      <View style={[styles.base, { backgroundColor: ds.c.raised }]}>
        <Caption tone="muted">Base</Caption>
        <TextInput
          value={base}
          placeholder="What you want to foam"
          placeholderTextColor={ds.c.muted}
          aria-label="Base: what you want to foam"
          onChangeText={(v) => {
            setBase(v);
            // Cream, coconut or nut milk in the base: fat starts on Yes (still yours to change).
            if (baseHasFat(v)) setQ((s) => ({ ...s, fat: true }));
          }}
          style={[styles.input, type.body, { fontFamily: fontFamilies.body, color: ds.c.ink }]}
        />
      </View>
      {kind ? null : <Choice label="What kind?" options={KINDS} value={q.kind} onChange={set('kind')} />}
      <Choice label="Fat in it?" options={[{ value: false, label: 'No' }, { value: true, label: 'Yes' }]} value={q.fat} onChange={set('fat')} />
      <Choice label="How strong is what you foam?" options={[{ value: false, label: 'Under 20%' }, { value: true, label: 'Over 20%' }]} value={q.strong} onChange={set('strong')} />
      <Choice label="Anyone to watch for?" options={DIETS} value={q.diet} onChange={set('diet')} />

      <Section title="Pick one">
        {answer.note ? <Body>{answer.note}</Body> : null}
        {answer.works.map((a, i) => (
          <AgentCard key={a.id} a={a} first={i === 0} weak={q.strong && !a.strongOk} onUse={onUse && a.perDrink ? () => onUse(a) : undefined} />
        ))}
        {answer.ruledOut.map(({ agent, why }) => (
          <View key={agent.id} style={styles.out}>
            <Caption tone="muted" style={[styles.flex, styles.struck]}>
              {agent.name}
            </Caption>
            <Caption tone="muted">{why}</Caption>
          </View>
        ))}
      </Section>
    </View>
  );
}

/**
 * One foamer that works, as a compact row (prep-tech-foam): its name, START
 * HERE on the first, the dose, how and how far to trust it, and an outlined
 * Use that adds it to the spec or opens its steps.
 */
function AgentCard({ a, first, weak, onUse }: { a: FoamAgent; first: boolean; weak: boolean; onUse?: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const use = onUse ?? (a.technique ? () => router.push(`/techniques/${a.technique}` as never) : undefined);
  const badge = first ? 'START HERE' : weak ? 'WEAK IN SPIRIT' : null;
  return (
    <View style={[styles.card, { backgroundColor: ds.c.raised, borderColor: first ? ds.accentText : 'transparent' }]}>
      <View style={styles.flex}>
        <View style={styles.name}>
          <Body>{a.name}</Body>
          {badge ? (
            <Caption tone={first ? 'accent' : 'muted'} style={styles.badge}>
              {badge}
            </Caption>
          ) : null}
        </View>
        <Caption tone="muted">{a.dose}</Caption>
        <Caption tone="muted">{[a.how, gradeLabel(a.grade)].filter(Boolean).join(' · ')}</Caption>
      </View>
      {use ? (
        <Button
          label="Use"
          variant="secondary"
          accessibilityLabel={onUse ? `Use ${a.name}: ${a.perDrink!.amount} ${a.perDrink!.unit}` : `Use ${a.name}: open its steps`}
          onPress={use}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  question: { gap: space.sm },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1 },
  // Equal shares of the row, wrapping when the answers don't fit (a narrow dialog).
  segments: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  segment: { flexGrow: 1, flexBasis: 0, minWidth: 64, minHeight: layout.minTapTarget, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xs, borderRadius: radius.control, borderWidth: 1 },
  medium: { fontFamily: fontFamilies.bodyMedium },
  base: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, borderRadius: radius.control },
  input: { flex: 1, minHeight: layout.minTapTarget + space.xs },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.control, borderWidth: 1 },
  name: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: space.sm },
  badge: { fontFamily: fontFamilies.mono, letterSpacing: 1 },
  out: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm },
  struck: { textDecorationLine: 'line-through' },
  flex: { flex: 1, minWidth: 0, gap: 2 },
});
