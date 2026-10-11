import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, DsText, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { METHOD_GROUPS, methodDetail, samePick, type WizardPick } from '@/lib/drinkWizard';

import { OwnField } from './PickStep';
import { Eyebrow, WizardChip } from './WizardChrome';

interface MethodStepProps {
  /** Every method we know (choiceList): the groups use the existing rows. */
  options: WizardPick[];
  selected: WizardPick[];
  onChange: (next: WizardPick[]) => void;
  /** Our guess from the spec ("Shake"), marked while nothing is picked. */
  suggested?: string | null;
  why?: string | null;
  /** Under the steps, above the chips: the foamer hint. */
  hint?: ReactNode;
}

/**
 * How it's made: the picks first, as numbered steps in the order tapped
 * ("1 Dry shake, 15 s, no ice"), then every method in three groups (Mix,
 * Air and texture, Finish), and a field for your own.
 */
export function MethodStep({ options, selected, onChange, suggested, why, hint }: MethodStepProps) {
  const ds = useDs();
  const find = (name: string) => options.find((o) => samePick(o, { id: null, name })) ?? { id: null, name };
  const order = (p: WizardPick) => selected.findIndex((s) => samePick(s, p));
  const toggle = (p: WizardPick) => {
    const at = order(p);
    onChange(at >= 0 ? selected.filter((_, i) => i !== at) : [...selected, p]);
  };
  const guess = suggested && !selected.length ? find(suggested) : null;
  const grouped = METHOD_GROUPS.map((g) => ({ label: g.label, picks: g.methods.map(find) }));
  // Your own, and anything from a classic's spec outside the groups, stay on as chips.
  const own = selected.filter((s) => !grouped.some((g) => g.picks.some((p) => samePick(p, s))));
  if (own.length) grouped.push({ label: 'Your own', picks: own });

  return (
    <View style={styles.stack}>
      {selected.length ? (
        <View role="list" aria-label="In order" style={styles.steps}>
          {selected.map((m, i) => {
            const detail = methodDetail(m.name);
            return (
              <View key={m.id ?? `new:${m.name}`} role="listitem" style={[styles.step, { backgroundColor: ds.c.surface }]}>
                <View style={[styles.number, { backgroundColor: ds.accentFill.fill }]}>
                  <DsText variant="caption" color={ds.accentFill.text}>
                    {String(i + 1)}
                  </DsText>
                </View>
                <View style={styles.flex}>
                  <Body>{m.name}</Body>
                  {detail ? <Caption tone="muted">{detail}</Caption> : null}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
      {hint}
      {grouped.map((g) => (
        <View key={g.label} style={styles.group}>
          <Eyebrow>{g.label}</Eyebrow>
          <View role="group" accessibilityLabel={g.label} style={styles.chips}>
            {g.picks.map((p) => (
              <WizardChip
                key={p.id ?? `new:${p.name}`}
                kind="checkbox"
                label={p.name}
                selected={order(p) >= 0}
                suggested={!!guess && samePick(p, guess)}
                onPress={() => toggle(p)}
              />
            ))}
          </View>
        </View>
      ))}
      {guess && why ? <Caption tone="muted">{`Suggested: ${why}.`}</Caption> : null}
      {selected.length > 1 ? <Caption tone="muted">{selected.map((s, i) => (i ? s.name.toLowerCase() : s.name)).join(', then ')}</Caption> : null}
      <OwnField
        label="Your own method"
        onAdd={(name) => {
          const pick = [...options, ...own].find((o) => samePick(o, { id: null, name })) ?? { id: null, name };
          if (order(pick) < 0) onChange([...selected, pick]);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  steps: { gap: space.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.control, borderCurve: 'continuous' },
  number: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
