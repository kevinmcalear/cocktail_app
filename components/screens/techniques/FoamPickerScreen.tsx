import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Chip, Headline, PressableScale, Surface, useDs } from '@/components/ds';
import { GradeTag, Section } from '@/components/techniques/bits';
import { TechniquePage } from '@/components/techniques/TechniquePage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { pickFoam, type Diet, type FoamAgent, type FoamKind, type FoamQuestion } from '@/lib/techniques/foamPicker';

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

/** Foam from anything: what kind, fat, strength and diet narrow the foamers to one to start with, and say why the rest are out. */
export function FoamPickerScreen() {
  const [q, setQ] = useState<FoamQuestion>({ kind: 'shaken', fat: false, strong: false, diet: 'none' });
  const set = <K extends keyof FoamQuestion>(k: K) => (v: FoamQuestion[K]) => setQ((s) => ({ ...s, [k]: v }));
  const answer = pickFoam(q);

  return (
    <TechniquePage eyebrow="Foams and airs" title="Foam from anything" intro={<Body tone="muted">Any flavourful liquid can foam. Answer four questions and pick one foamer.</Body>}>
      <Choice label="What kind of foam?" options={KINDS} value={q.kind} onChange={set('kind')} />
      <Choice label="Any fat in it? Cream, butter, coconut, nut milk" options={[{ value: false, label: 'No' }, { value: true, label: 'Yes' }]} value={q.fat} onChange={set('fat')} />
      {q.kind !== 'shaken' ? (
        <Choice label="How strong is what you’re foaming?" options={[{ value: false, label: 'Under 20%' }, { value: true, label: 'Over 20%' }]} value={q.strong} onChange={set('strong')} />
      ) : null}
      <Choice label="Anyone to watch for?" options={DIETS} value={q.diet} onChange={set('diet')} />

      <Section title="Pick one">
        {answer.note ? <Body>{answer.note}</Body> : null}
        {answer.works.map((a, i) => (
          <AgentCard key={a.id} a={a} first={i === 0} />
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
    </TechniquePage>
  );
}

function AgentCard({ a, first }: { a: FoamAgent; first: boolean }) {
  const ds = useDs();
  const router = useRouter();
  const body = (
    <>
      <View style={styles.flex}>
        <Headline>{first ? `${a.name} · start here` : a.name}</Headline>
        <Body>{a.dose}</Body>
        <Caption tone="muted">{a.how}</Caption>
        <View style={styles.tag}>
          <GradeTag grade={a.grade} />
        </View>
      </View>
      {a.technique ? <IconSymbol name="chevron.right" size={16} color={ds.c.muted} /> : null}
    </>
  );
  const style = [styles.card, first ? { borderColor: ds.c.ink, borderWidth: 1 } : null];
  return a.technique ? (
    <PressableScale role="link" accessibilityLabel={`${a.name}. ${a.dose}. ${a.how}. Open the steps`} onPress={() => router.push(`/techniques/${a.technique}` as never)}>
      <Surface style={style}>{body}</Surface>
    </PressableScale>
  ) : (
    <Surface style={style}>{body}</Surface>
  );
}

const styles = StyleSheet.create({
  question: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  out: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm },
  tag: { flexDirection: 'row', paddingTop: space.xs },
  flex: { flex: 1, minWidth: 0, gap: 2 },
});
