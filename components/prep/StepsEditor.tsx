import { StyleSheet, View } from 'react-native';

import { Button, Caption, Field, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, space } from '@/constants/tokens';

export interface StepDraft {
  key: string;
  body: string;
  /** Minutes, as typed. */
  timer: string;
}

let nextKey = 0;
export const newStep = (body = '', timer = ''): StepDraft => ({ key: `s${nextKey++}`, body, timer });

/** Numbered steps, each with an optional timer in minutes. */
export function StepsEditor({ steps, onChange }: { steps: StepDraft[]; onChange: (steps: StepDraft[]) => void }) {
  const ds = useDs();
  const update = (key: string, patch: Partial<StepDraft>) => onChange(steps.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  return (
    <View style={styles.steps}>
      <Caption tone="muted">Steps</Caption>
      {steps.map((s, i) => (
        <View key={s.key} style={styles.step}>
          <Caption tone="muted" style={styles.number}>
            {i + 1}
          </Caption>
          <View style={styles.fields}>
            <Field label={`Step ${i + 1}`} value={s.body} onChangeText={(body) => update(s.key, { body })} placeholder="Stir the honey into the hot water" multiline />
            <View style={styles.row}>
              <View style={styles.timer}>
                <Field label="Timer (minutes)" value={s.timer} onChangeText={(timer) => update(s.key, { timer: timer.replace(/[^\d]/g, '') })} placeholder="10" keyboardType="number-pad" />
              </View>
              <PressableScale accessibilityLabel={`Remove step ${i + 1}`} onPress={() => onChange(steps.filter((x) => x.key !== s.key))} style={styles.remove}>
                <IconSymbol name="trash" size={18} color={ds.c.muted} />
              </PressableScale>
            </View>
          </View>
        </View>
      ))}
      <Button label="Add a step" variant="secondary" icon="plus" onPress={() => onChange([...steps, newStep()])} style={styles.add} />
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { gap: space.md },
  step: { flexDirection: 'row', gap: space.sm },
  number: { width: 20, paddingTop: space.xs },
  fields: { flex: 1, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  timer: { flex: 1 },
  remove: { minHeight: layout.minTapTarget, minWidth: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  add: { alignSelf: 'flex-start' },
});
