import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Spec, Surface, Tag, useDs } from '@/components/ds';
import { StepTimer } from '@/components/prep/StepTimer';
import { GradeTag, gradeLong, LinkRow, Notes, Section, SourceList } from '@/components/techniques/bits';
import { Scaler } from '@/components/techniques/Scaler';
import { TechniquePage } from '@/components/techniques/TechniquePage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { equipmentById, groupById, techniqueById } from '@/lib/techniques';
import { useKit } from '@/store/useKitStore';

const GATE = {
  safety: 'This can hurt someone. Read every warning before you start.',
  legal: 'This is restricted by law in many places. Check before you start.',
};

/** One technique, "just do this": the facts, the amounts for your batch, the steps with timers, the kit, the warnings and the sources. */
export function TechniqueScreen({ id }: { id: string }) {
  const ds = useDs();
  const router = useRouter();
  const kit = useKit();
  const t = techniqueById(id);
  if (!t) {
    return (
      <TechniquePage title="Not found" intro={<Body tone="muted">That technique isn’t in the library.</Body>}>
        <Button label="All techniques" onPress={() => router.replace('/techniques' as never)} />
      </TechniquePage>
    );
  }
  const group = groupById(t.group);
  const facts = [
    { label: 'Takes', value: t.time },
    t.keeps ? { label: 'Keeps', value: t.keeps } : null,
  ].filter((f): f is { label: string; value: string } => !!f);
  const kitRows = [...t.equipment.map((e) => ({ id: e, needed: true })), ...(t.helpful ?? []).map((e) => ({ id: e, needed: false }))];

  return (
    <TechniquePage eyebrow={group?.name} title={t.name} intro={<Body tone="muted">{t.summary}</Body>}>
      {t.gate ? (
        <Surface style={[styles.gate, { borderColor: ds.c.ink }]}>
          <IconSymbol name="exclamationmark.triangle" size={20} color={ds.c.ink} />
          <Body style={styles.flex}>{GATE[t.gate]}</Body>
        </Surface>
      ) : null}

      <View style={styles.facts}>
        {facts.map((f) => (
          <View key={f.label} style={[styles.fact, { backgroundColor: ds.c.raised, flexBasis: f.value.length > 16 ? '100%' : '30%' }]}>
            <Caption tone="muted">{f.label}</Caption>
            {/* A figure reads in the spec face; a sentence reads better as body text. */}
            {f.value.length > 16 ? <Body>{f.value}</Body> : <Spec>{f.value}</Spec>}
          </View>
        ))}
      </View>
      <View style={styles.tags}>
        <GradeTag grade={t.grade} />
        {t.vegan ? <Tag label="Vegan" /> : null}
        {(t.allergens ?? []).map((a) => (
          <Tag key={a} label={a} tone="warning" />
        ))}
      </View>
      <Body>{t.why}</Body>

      {t.base && t.parts ? <Scaler base={t.base} parts={t.parts} /> : null}

      <Section title="Steps">
        {t.steps.map((s, i) => (
          <View key={s.text} style={styles.step}>
            <Caption tone="muted" style={styles.number}>
              {i + 1}
            </Caption>
            <Body style={styles.flex}>{s.text}</Body>
            {s.timer ? <StepTimer seconds={s.timer} /> : null}
          </View>
        ))}
      </Section>

      {t.watch?.length ? (
        <Section title="Watch out">
          <Notes items={t.watch} />
        </Section>
      ) : null}
      {t.swap ? (
        <Section title="Swap">
          <Notes items={[t.swap]} icon="arrow.up.and.down" />
        </Section>
      ) : null}
      {t.unknown ? (
        <Section title="Not measured yet">
          <Body tone="muted">{t.unknown}</Body>
        </Section>
      ) : null}

      {kitRows.length ? (
        <Section title="Kit">
          {kitRows.map(({ id: e, needed }) => {
            const item = equipmentById(e);
            if (!item) return null;
            const detail = [needed ? 'Needed' : 'Helps', kit.has(e) ? 'You have it' : item.swap ? `Without one: ${item.swap}` : null].filter(Boolean).join(' · ');
            return <LinkRow key={e} title={item.name} detail={detail} href={`/equipment/${e}`} />;
          })}
        </Section>
      ) : null}

      <Section title="Where the numbers come from">
        <Caption tone="muted">{`${gradeLong(t.grade)}. Written in our own words; open a source for the full story.`}</Caption>
        <SourceList sources={t.sources} />
      </Section>
    </TechniquePage>
  );
}

const styles = StyleSheet.create({
  gate: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fact: { flexGrow: 1, flexShrink: 1, maxWidth: '100%', padding: space.sm, borderRadius: radius.control, gap: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs },
  number: { width: 20 },
  flex: { flex: 1, minWidth: 0 },
});
