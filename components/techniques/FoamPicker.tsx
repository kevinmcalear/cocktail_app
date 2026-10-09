import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, Headline, PressableScale, Surface, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { pickFoam, type Diet, type FoamAgent, type FoamKind, type FoamQuestion } from '@/lib/techniques/foamPicker';

import { GradeTag, Section } from './bits';

const KINDS: { value: FoamKind; label: string }[] = [
  { value: 'shaken', label: 'Shaken head on a sour' },
  { value: 'siphon', label: 'Siphon foam (iSi)' },
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
  const set = <K extends keyof FoamQuestion>(k: K) => (v: FoamQuestion[K]) => setQ((s) => ({ ...s, [k]: v }));
  const answer = pickFoam(q);

  return (
    <View style={styles.stack}>
      {kind ? null : <Choice label="What kind of foam?" options={KINDS} value={q.kind} onChange={set('kind')} />}
      <Choice label="Any fat in it? Cream, butter, coconut, nut milk" options={[{ value: false, label: 'No' }, { value: true, label: 'Yes' }]} value={q.fat} onChange={set('fat')} />
      {q.kind !== 'shaken' ? (
        <Choice label="How strong is what you’re foaming?" options={[{ value: false, label: 'Under 20%' }, { value: true, label: 'Over 20%' }]} value={q.strong} onChange={set('strong')} />
      ) : null}
      <Choice label="Anyone to watch for?" options={DIETS} value={q.diet} onChange={set('diet')} />

      <Section title="Pick one">
        {answer.note ? <Body>{answer.note}</Body> : null}
        {answer.works.map((a, i) => (
          <AgentCard key={a.id} a={a} first={i === 0} onUse={onUse && a.perDrink ? () => onUse(a) : undefined} />
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

function AgentCard({ a, first, onUse }: { a: FoamAgent; first: boolean; onUse?: () => void }) {
  const ds = useDs();
  const router = useRouter();
  const open = a.technique ? () => router.push(`/techniques/${a.technique}` as never) : undefined;
  const info = (
    <View style={styles.flex}>
      <Headline>{first ? `${a.name} · start here` : a.name}</Headline>
      <Body>{a.dose}</Body>
      <Caption tone="muted">{a.how}</Caption>
      <View style={styles.tag}>
        <GradeTag grade={a.grade} />
      </View>
    </View>
  );
  const style = [styles.card, first ? { borderColor: ds.c.ink, borderWidth: 1 } : null];
  if (onUse) {
    return (
      <Surface style={style}>
        {info}
        <Button label="Use" variant={first ? 'primary' : 'secondary'} accessibilityLabel={`Use ${a.name}: ${a.perDrink!.amount} ${a.perDrink!.unit}`} onPress={onUse} />
      </Surface>
    );
  }
  return open ? (
    <PressableScale role="link" accessibilityLabel={`${a.name}. ${a.dose}. ${a.how}. Open the steps`} onPress={open}>
      <Surface style={style}>
        {info}
        <IconSymbol name="chevron.right" size={16} color={ds.c.muted} />
      </Surface>
    </PressableScale>
  ) : (
    <Surface style={style}>{info}</Surface>
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
