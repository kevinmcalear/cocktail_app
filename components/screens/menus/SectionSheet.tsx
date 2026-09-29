import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field } from '@/components/ds';
import { space } from '@/constants/tokens';
import { sectionRuleProblem, type EditSection, type SectionRule } from '@/lib/menuLayout';
import type { SectionDrinkType } from '@/lib/sectionAllowedTypes';

import { Choice, MenuSheet } from './MenuSheet';

const KINDS: { value: SectionDrinkType; label: string }[] = [
  { value: 'cocktail', label: 'Cocktails' },
  { value: 'beer', label: 'Beer' },
  { value: 'wine', label: 'Wine' },
];

interface SectionSheetProps {
  section: EditSection;
  isFirst: boolean;
  isLast: boolean;
  onClose: () => void;
  onSave: (rule: SectionRule) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}

const toCount = (text: string): number | null => (text.trim() === '' ? null : Number(text));

/** A section's name and rules: what it takes and how many. */
export function SectionSheet({ section, isFirst, isLast, onClose, onSave, onMove, onRemove }: SectionSheetProps) {
  const [name, setName] = useState(section.name);
  const [types, setTypes] = useState<SectionDrinkType[]>(section.allowedTypes);
  const [min, setMin] = useState(String(section.minItems));
  const [max, setMax] = useState(section.maxItems === null ? '' : String(section.maxItems));
  const [error, setError] = useState<string | null>(null);

  const rule: SectionRule = { name, allowedTypes: types, minItems: toCount(min) ?? 0, maxItems: toCount(max) };
  const dropped = section.drinks.filter((d) => !types.includes(d.kind)).length;
  const toggle = (t: SectionDrinkType) => setTypes((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : KINDS.map((k) => k.value).filter((k) => ts.includes(k) || k === t)));

  const save = () => {
    const problem = sectionRuleProblem(rule);
    if (problem) return setError(problem);
    onSave({ ...rule, name: name.trim() });
    onClose();
  };

  return (
    <MenuSheet visible onClose={onClose} title={section.name || 'Section'} footer={<Button size="lg" label="Done" onPress={save} />}>
      <Field label="Name" value={name} onChangeText={setName} placeholder="Stirred" />
      <Caption tone="muted">Takes</Caption>
      <View style={styles.wrap}>
        {KINDS.map((k) => (
          <Choice key={k.value} kind="checkbox" label={k.label} selected={types.includes(k.value)} onPress={() => toggle(k.value)} />
        ))}
      </View>
      {dropped ? <Body tone="accent">{`${dropped} drink${dropped === 1 ? '' : 's'} in it won’t fit and will come off.`}</Body> : null}
      <View style={styles.pair}>
        <View style={styles.flex}>
          <Field label="At least" value={min} onChangeText={setMin} keyboardType="number-pad" placeholder="0" />
        </View>
        <View style={styles.flex}>
          <Field label="At most" value={max} onChangeText={setMax} keyboardType="number-pad" placeholder="No limit" />
        </View>
      </View>
      {error ? <Body tone="accent">{error}</Body> : null}
      <View style={styles.wrap}>
        <Button label="Move up" icon="chevron.up" variant="secondary" disabled={isFirst} onPress={() => onMove(-1)} />
        <Button label="Move down" icon="chevron.down" variant="secondary" disabled={isLast} onPress={() => onMove(1)} />
      </View>
      <Button
        label="Remove section"
        icon="trash"
        variant="ghost"
        onPress={() => {
          onRemove();
          onClose();
        }}
      />
    </MenuSheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pair: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
