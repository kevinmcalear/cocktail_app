import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Body, Caption, Chip, DsText, Field, PressableScale, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { equipmentById, GROUPS, searchTechniques, TECHNIQUES, type Technique, type TechniqueGroup } from '@/lib/techniques';
import { byKit, needsText } from '@/lib/techniques/kitFirst';
import { waysToMake } from '@/lib/techniques/makeIt';

import { Eyebrow } from '../WizardChrome';

/** The chips, and the groups' order, as the board has them (make-anything-steps-1, step 4, more to it), then the two groups it leaves off. */
const CHIPS: { id: TechniqueGroup; label: string }[] = [
  { id: 'infuse', label: 'Infuse' },
  { id: 'clarify', label: 'Clarify' },
  { id: 'wash', label: 'Wash' },
  { id: 'distil', label: 'Distil' },
  { id: 'preserve', label: 'Ferment' },
  { id: 'syrup', label: 'Syrups' },
  { id: 'texture', label: 'Texture' },
  { id: 'foam', label: 'Foams' },
  { id: 'cold', label: 'Cold' },
  { id: 'cook', label: 'Cook' },
  { id: 'age', label: 'Age' },
  { id: 'carbonate', label: 'Carbonate' },
  { id: 'garnish', label: 'Garnish' },
];

/** What can be made in house: a method (a dry shake) never is. */
const MADE = TECHNIQUES.filter((t) => !t.method);

interface EveryTechniqueProps {
  /** What's being made, for the techniques its name points to. */
  name: string;
  /** The technique picked, if any. */
  selected: string | null;
  /** Null while it loads: nothing dims. */
  kit: ReadonlySet<string> | null;
  onPick: (id: string) => void;
  /** "I have this": the pieces go on the kit. Null for someone who can't change it. */
  onAdd: ((equipmentIds: string[]) => void) | null;
  /** Write it yourself: a blank recipe. */
  onWrite: () => void;
}

/**
 * Something else (make-anything-steps-1, step 4, more to it): every
 * technique in the library, searchable and by group. In each group what the
 * kit covers comes first; the rest stay, dimmed, with I have this. Nothing
 * is hidden. A name a technique makes ("espresso foam") puts those first.
 */
export function EveryTechnique({ name, selected, kit, onPick, onAdd, onWrite }: EveryTechniqueProps) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<TechniqueGroup | null>(null);
  const found = searchTechniques(query, MADE).filter((t) => !group || t.group === group);
  const fromName = query || group ? [] : waysToMake(name);
  const row = (t: Technique, key = t.id) => <TechniqueRow key={key} t={t} kit={kit} on={selected === t.id} onPress={() => onPick(t.id)} onAdd={onAdd} />;
  return (
    <View style={styles.stack}>
      <Field label="Search techniques" value={query} onChangeText={setQuery} returnKeyType="search" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} role="radiogroup" accessibilityLabel="Kind of technique">
        <Chip label="All" selected={!group} onPress={() => setGroup(null)} />
        {CHIPS.map((c) => (
          <Chip key={c.id} label={c.label} selected={group === c.id} onPress={() => setGroup(group === c.id ? null : c.id)} />
        ))}
      </ScrollView>
      {fromName.length ? (
        <View style={styles.stack}>
          <Eyebrow>From the name</Eyebrow>
          {fromName.map((t) => row(t, `name-${t.id}`))}
        </View>
      ) : null}
      {CHIPS.map(({ id }) => {
        const g = GROUPS.find((x) => x.id === id)!;
        const { have, need } = byKit(found.filter((t) => t.group === id), kit);
        if (!have.length && !need.length) return null;
        return (
          <View key={g.id} style={styles.stack}>
            <Eyebrow>{g.name}</Eyebrow>
            {[...have, ...need].map((t) => row(t))}
          </View>
        );
      })}
      {!found.length ? <Caption tone="muted">No technique by that name. Write it yourself.</Caption> : null}
      <PressableScale role="button" onPress={onWrite} accessibilityLabel="Write it yourself: a blank recipe" style={styles.write}>
        <Body tone="accent">Write it yourself</Body>
      </PressableScale>
    </View>
  );
}

/**
 * One technique, kit first (make-anything-steps-1, step 4, more to it): its
 * name and grade, how long, and the kit it takes ("Nothing special"); one
 * the kit doesn't cover is dimmed, says what it needs and offers I have this.
 */
export function TechniqueRow({ t, label, kit, on, onPress, onAdd }: { t: Technique; label?: string; kit: ReadonlySet<string> | null; on: boolean; onPress: () => void; onAdd: ((equipmentIds: string[]) => void) | null }) {
  const ds = useDs();
  const missing = kit ? t.equipment.filter((id) => !kit.has(id)) : [];
  const tools = t.equipment.map((id) => equipmentById(id)?.name ?? id).join(', ') || 'Nothing special';
  const needs = missing.length ? needsText(missing) : null;
  const name = label ?? t.name;
  return (
    <View style={styles.rowWrap}>
      <PressableScale
        role="radio"
        aria-checked={on}
        accessibilityLabel={[name, t.time, needs ?? tools, `How sure the sources are: ${t.grade}`].join('. ')}
        onPress={onPress}
        style={[styles.row, missing.length && !on ? styles.dim : null, { backgroundColor: ds.c.raised, borderColor: on ? ds.accentText : 'transparent' }]}
      >
        <View style={styles.head}>
          <Body style={styles.flex}>{name}</Body>
          <View aria-hidden style={[styles.grade, { borderColor: ds.c.lineStrong }]}>
            <DsText variant="caption" style={styles.mono}>
              {t.grade}
            </DsText>
          </View>
        </View>
        <Caption tone="muted">{`${t.time} · ${needs ?? tools}`}</Caption>
      </PressableScale>
      {missing.length && onAdd ? (
        <PressableScale role="button" onPress={() => onAdd(missing)} accessibilityLabel={`I have this: add ${missing.map((id) => equipmentById(id)?.name ?? id).join(' and ')} to your kit`} style={styles.have}>
          <Caption tone="accent">I have this</Caption>
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  chips: { gap: space.xs, paddingVertical: space.xs },
  rowWrap: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dim: { opacity: 0.6 },
  row: { flex: 1, gap: space.xs, paddingHorizontal: space.md, paddingVertical: space.md, borderRadius: radius.control, borderWidth: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  grade: { paddingHorizontal: space.xs + 2, borderRadius: radius.mark + 2, borderWidth: 1 },
  mono: { fontFamily: fontFamilies.monoMedium },
  have: { minHeight: layout.minTapTarget, justifyContent: 'center', paddingHorizontal: space.xs },
  write: { minHeight: layout.minTapTarget, justifyContent: 'center', alignSelf: 'flex-start' },
});
