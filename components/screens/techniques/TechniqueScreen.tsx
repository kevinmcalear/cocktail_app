import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Chip, PressableScale, Spec, Surface, Tag, useDs } from '@/components/ds';
import { StepTimer } from '@/components/prep/StepTimer';
import { gradeLong, Notes, Section, SourceList } from '@/components/techniques/bits';
import { Scaler } from '@/components/techniques/Scaler';
import { TechniquePage } from '@/components/techniques/TechniquePage';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space, type } from '@/constants/tokens';
import { equipmentById, groupById, techniqueById } from '@/lib/techniques';
import { factTiles, swapLine } from '@/lib/techniques/facts';
import { useKit } from '@/hooks/useKit';

const GATE = {
  safety: 'This can hurt someone. Read every warning before you start.',
  legal: 'This is restricted by law in many places. Check before you start.',
};

/** One technique, "just do this": the facts, the amounts for your batch, the steps with timers, the kit, the warnings and the sources. */
export function TechniqueScreen({ id }: { id: string }) {
  const ds = useDs();
  const router = useRouter();
  const { kit } = useKit();
  const [done, setDone] = useState<number[]>([]);
  const t = techniqueById(id);
  if (!t) {
    return (
      <TechniquePage title="Not found" intro={<Body tone="muted">That technique isn’t in the library.</Body>}>
        <Button label="All techniques" onPress={() => router.replace('/techniques' as never)} />
      </TechniquePage>
    );
  }
  const group = groupById(t.group);
  const facts = factTiles(t);
  const allergens = t.allergens ?? [];
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
          <View key={f.caption} style={[styles.fact, { backgroundColor: ds.c.raised, flexBasis: f.value.length > 16 ? '100%' : '28%' }]}>
            {/* A figure reads big in the spec face; a sentence reads better as body text. */}
            {f.value.length > 16 ? <Body>{f.value}</Body> : <Spec style={styles.big}>{f.value}</Spec>}
            <Caption tone="muted">{f.caption}</Caption>
          </View>
        ))}
      </View>
      {t.vegan ? (
        <View style={styles.tags}>
          <Tag label="Vegan" />
        </View>
      ) : null}
      <Body>{t.why}</Body>

      {t.base && t.parts ? <Scaler base={t.base} parts={t.parts} /> : null}

      <Section title="Steps">
        {t.steps.map((s, i) => {
          const on = done.includes(i);
          return (
            <View key={s.text} style={styles.step}>
              <PressableScale
                role="checkbox"
                aria-checked={on}
                accessibilityLabel={`Done: ${s.text}`}
                onPress={() => setDone((d) => (on ? d.filter((x) => x !== i) : [...d, i]))}
                style={styles.tap}
              >
                <View style={[styles.box, { borderColor: on ? ds.c.ink : ds.c.lineStrong, backgroundColor: on ? ds.c.ink : 'transparent' }]}>
                  {on ? <IconSymbol name="checkmark" size={16} color={ds.c.ground} /> : null}
                </View>
              </PressableScale>
              <Body tone={on ? 'muted' : 'ink'} style={[styles.flex, on && styles.struck]}>
                {s.text}
              </Body>
              {s.timer ? <StepTimer seconds={s.timer} /> : null}
            </View>
          );
        })}
      </Section>

      {allergens.length || t.swap ? (
        <Surface style={[styles.callout, { backgroundColor: ds.c.raised }]}>
          <IconSymbol name="exclamationmark.triangle" size={18} color={ds.c.ink} />
          <Body style={styles.flex}>
            {[allergens.length ? `Contains ${allergens.join(', ').toLowerCase()}: drinks that use this carry it as an allergen.` : null, t.swap ? swapLine(t.swap) : null].filter(Boolean).join(' ')}
          </Body>
        </Surface>
      ) : null}

      {t.watch?.length ? (
        <Section title="Watch out">
          <Notes items={t.watch} />
        </Section>
      ) : null}
      {t.unknown ? (
        <Section title="Not measured yet">
          <Body tone="muted">{t.unknown}</Body>
        </Section>
      ) : null}

      {kitRows.length ? (
        <Section title="Kit">
          <View style={styles.tags}>
            {kitRows.map(({ id: e, needed }) => {
              const item = equipmentById(e);
              if (!item) return null;
              const detail = [needed ? 'Needed' : 'Helps', kit.has(e) ? 'you have it' : item.swap ? `without one: ${item.swap}` : null].filter(Boolean).join(', ');
              return (
                <Chip key={e} label={needed ? item.name : `${item.name} (helps)`} quiet selected={false} accessibilityLabel={`${item.name}. ${detail}. Opens the kit page`} onPress={() => router.push(`/equipment/${e}` as never)} />
              );
            })}
          </View>
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
  big: { ...type.headline },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs },
  tap: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center', marginLeft: -space.sm },
  box: { width: 28, height: 28, borderRadius: radius.control, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  struck: { textDecorationLine: 'line-through' },
  callout: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  flex: { flex: 1, minWidth: 0 },
});
