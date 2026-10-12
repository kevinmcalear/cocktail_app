import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Field, Headline, Surface, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { baseHasFat, pickFoam, type Diet, type FoamAgent, type FoamKind, type FoamQuestion } from '@/lib/techniques/foamPicker';

import { GradeTag, Section } from './bits';

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

function Choice<T extends string | boolean>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View role="radiogroup" aria-label={label} style={styles.question}>
      <Caption tone="muted">{label.toUpperCase()}</Caption>
      <View style={styles.chips}>
        {options.map((o) => (
          <Chip key={String(o.value)} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
        ))}
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
  const [q, setQ] = useState<FoamQuestion>({ kind: kind ?? 'shaken', fat: false, strong: false, diet });
  const [base, setBase] = useState('');
  const set = <K extends keyof FoamQuestion>(k: K) => (v: FoamQuestion[K]) => setQ((s) => ({ ...s, [k]: v }));
  const answer = pickFoam(q);

  return (
    <View style={styles.stack}>
      <Field
        label="Base"
        placeholder="What you want to foam"
        value={base}
        onChangeText={(v) => {
          setBase(v);
          // Cream, coconut or nut milk in the base: fat starts on Yes (still yours to change).
          if (baseHasFat(v)) setQ((s) => ({ ...s, fat: true }));
        }}
      />
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
            <Body tone="muted" style={styles.flex}>
              {agent.name}
            </Body>
            <Caption tone="muted">{why}</Caption>
          </View>
        ))}
      </Section>
    </View>
  );
}

/** One foamer that works: Use adds it to the spec, or opens its steps from the library. */
function AgentCard({ a, first, weak, onUse }: { a: FoamAgent; first: boolean; weak: boolean; onUse?: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const use = onUse ?? (a.technique ? () => router.push(`/techniques/${a.technique}` as never) : undefined);
  const badge = first ? 'start here' : weak ? 'weak in spirit' : null;
  return (
    <Surface style={[styles.card, first ? { borderColor: ds.c.ink, borderWidth: 1 } : null]}>
      <View style={styles.flex}>
        <Headline>{badge ? `${a.name} · ${badge}` : a.name}</Headline>
        <Body>{a.dose}</Body>
        <Caption tone="muted">{a.how}</Caption>
        <View style={styles.tag}>
          <GradeTag grade={a.grade} />
        </View>
      </View>
      {use ? (
        <Button
          label="Use"
          variant={first ? 'primary' : 'secondary'}
          accessibilityLabel={onUse ? `Use ${a.name}: ${a.perDrink!.amount} ${a.perDrink!.unit}` : `Use ${a.name}: open its steps`}
          onPress={use}
        />
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.xl },
  question: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  out: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm },
  tag: { flexDirection: 'row', paddingTop: space.xs },
  flex: { flex: 1, minWidth: 0, gap: 2 },
});
