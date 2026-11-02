import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Surface, Tag, useDs } from '@/components/ds';
import { SettingsRow } from '@/components/screens/settings/SettingsParts';
import { gradeLong, Group, Notes, Section, SourceList, ValueRow } from '@/components/techniques/bits';
import { EquipmentArt, EquipmentPanel } from '@/components/techniques/EquipmentBody';
import { Scaler } from '@/components/techniques/Scaler';
import { LEARN_CRUMBS, TechniquePage } from '@/components/techniques/TechniquePage';
import { TechniqueSteps } from '@/components/techniques/TechniqueSteps';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { palateHues, space } from '@/constants/tokens';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { useShelfHere } from '@/hooks/useBarKit';
import { equipmentById, groupById, techniqueById, type Equipment, type Technique } from '@/lib/techniques';
import { keepLine, ratioTile, swapLine } from '@/lib/techniques/facts';

const GATE = {
  safety: 'This can hurt someone. Read every warning before you start.',
  legal: 'This is restricted by law in many places. Check before you start.',
};

/**
 * One technique, as Kept-learn draws it: its tool drawn over the name, Time
 * and You need, then the steps. Wide web (Kept-learn-desk) puts the tool's
 * page beside it; a You need row picks which. The scaler, warnings and
 * sources aren't drawn and stay, after what is.
 */
export function TechniqueScreen({ id }: { id: string }) {
  const ds = useDs();
  const router = useRouter();
  const wide = useIsWideWeb();
  const t = techniqueById(id);
  const kitIds = t ? [...t.equipment, ...(t.helpful ?? [])] : [];
  const [shown, setShown] = useState<string | null>(null);
  if (!t) {
    return (
      <TechniquePage title="Not found" intro={<Body tone="muted">That technique isn’t in the library.</Body>} crumbs={LEARN_CRUMBS}>
        <Button label="All techniques" onPress={() => router.replace('/techniques' as Href)} />
      </TechniquePage>
    );
  }
  const group = groupById(t.group);
  const tool = equipmentById(shown ?? kitIds[0] ?? '');
  const open = (e: string) => (wide ? setShown(e) : router.push(`/equipment/${e}` as Href));
  return (
    <TechniquePage
      eyebrow={group ? `Technique · ${group.name}` : 'Technique'}
      title={t.name}
      intro={<Body tone="muted">{t.summary}</Body>}
      art={kitIds[0] ? <EquipmentArt id={kitIds[0]} plain /> : null}
      crumbs={group ? [...LEARN_CRUMBS, { label: group.name, href: `/techniques?group=${group.id}` }] : LEARN_CRUMBS}
      aside={tool ? <EquipmentPanel key={tool.id} e={tool} /> : null}
    >
      {t.gate ? (
        <Surface style={[styles.callout, styles.gate, { borderColor: ds.c.ink }]}>
          <IconSymbol name="exclamationmark.triangle" size={20} color={ds.c.ink} />
          <Body style={styles.flex}>{GATE[t.gate]}</Body>
        </Surface>
      ) : null}
      <Facts t={t} shown={wide ? (tool?.id ?? null) : null} onKit={open} />
      {t.vegan ? (
        <View style={styles.tags}>
          <Tag label="Vegan" />
        </View>
      ) : null}
      <Body>{t.why}</Body>
      {t.base && t.parts ? <Scaler base={t.base} parts={t.parts} /> : null}
      <Section title="Steps">
        <TechniqueSteps steps={t.steps} />
      </Section>
      {/* Drinks that use it (Kept-learn) comes with step K3: there's no link from a technique to drinks yet. */}
      <Warnings t={t} />
      <Section title="Where the numbers come from">
        <Caption tone="muted">{`${gradeLong(t.grade)}. Written in our own words; open a source for the full story.`}</Caption>
        <SourceList sources={t.sources} />
      </Section>
    </TechniquePage>
  );
}

/** Time, how long it keeps, the ratio, then a row for each tool: green when it's on your shelf. */
function Facts({ t, shown, onKit }: { t: Technique; shown: string | null; onKit: (id: string) => void }) {
  const ds = useDs();
  const { kit, bar } = useShelfHere();
  const ratio = ratioTile(t);
  const keep = keepLine(t);
  const tool = (id: string, label: string) => {
    const e: Equipment | undefined = equipmentById(id);
    if (!e) return null;
    const have = kit.has(id);
    // The tool's name leads (names run long); You need or Helps, and whether it's on your shelf, under it.
    return (
      <SettingsRow
        key={`${label}-${id}`}
        icon="hammer.fill"
        label={e.name}
        detail={[label, have ? (bar ? 'in the bar’s kit' : 'on your shelf') : e.swap ? `without one: ${e.swap.charAt(0).toLowerCase()}${e.swap.slice(1)}` : null].filter(Boolean).join(' · ')}
        onPress={() => onKit(id)}
        // Green when it's on your shelf; wide web: the tool beside the page is the one in the accent.
        trailing={have || shown === id ? <IconSymbol name={shown === id ? 'chevron.right' : 'checkmark'} size={16} color={shown === id ? ds.accentText : palateHues[ds.scheme].green} /> : undefined}
      />
    );
  };
  return (
    <Group>
      {[
        <ValueRow key="time" icon="clock" label="Time" value={t.time} />,
        keep ? <ValueRow key="keeps" icon="calendar" label="Keeps" value={keep} /> : null,
        ratio ? <ValueRow key="ratio" icon="percent" label="Ratio" value={`${ratio.value} (${ratio.caption})`} /> : null,
        ...(t.equipment.length ? t.equipment.map((e) => tool(e, 'You need')) : [<ValueRow key="none" icon="hammer.fill" label="You need" value="Nothing special" />]),
        ...(t.helpful ?? []).map((e) => tool(e, 'Helps')),
      ]}
    </Group>
  );
}

/** Not drawn on Kept-learn, kept for safety: allergens and swaps, what goes wrong, and what nobody has measured. */
function Warnings({ t }: { t: Technique }) {
  const ds = useDs();
  const allergens = t.allergens ?? [];
  const callout = [allergens.length ? `Contains ${allergens.join(', ').toLowerCase()}: drinks that use this carry it as an allergen.` : null, t.swap ? swapLine(t.swap) : null].filter(Boolean).join(' ');
  return (
    <>
      {callout ? (
        <Surface raised style={styles.callout}>
          <IconSymbol name="exclamationmark.triangle" size={18} color={ds.c.ink} />
          <Body style={styles.flex}>{callout}</Body>
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
    </>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  callout: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  gate: { borderWidth: 1 },
  flex: { flex: 1, minWidth: 0 },
});
