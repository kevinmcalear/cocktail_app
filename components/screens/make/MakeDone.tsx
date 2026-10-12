import { StyleSheet, View } from 'react-native';

import { Body, Caption, Field, Surface, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { radius, space } from '@/constants/tokens';
import { labelDate } from '@/lib/makeSteps';

import { LabelCard, type BatchLabel } from './MakeLabel';

export { copyForTape, shareLabel, type BatchLabel } from './MakeLabel';

interface MakeDoneProps {
  label: BatchLabel;
  /** Where it goes: its back bar spot ("Fridge 2 · top shelf"), else the prep's storage word. */
  goesIn: string | null;
  /** "It made": typed by whoever made it; the yield learns from it. Null when the prep has no volume or weight yield. */
  made: string | null;
  onMade: (v: string) => void;
  madeUnit: string | null;
}

/** Make, last screen: when it was made, when to use it by, where it goes, and the label to stick on it. */
export function MakeDone({ label, goesIn, made, onMade, madeUnit }: MakeDoneProps) {
  const ds = useDs();
  return (
    <View style={styles.stack}>
      <View style={[styles.tick, { backgroundColor: ds.c.ink }]}>
        <IconSymbol name="checkmark" size={24} color={ds.c.ground} />
      </View>
      <Title>Made. Label it.</Title>
      <Surface style={styles.facts}>
        <Row label="Made" value={`Today, ${labelDate(label.made)}${label.by ? ` · ${label.by}` : ''}`} />
        {label.useBy ? <Row label="Use by" value={labelDate(label.useBy)} strong /> : null}
        {goesIn ? <Row label="Goes in" value={goesIn} /> : null}
      </Surface>
      {made !== null ? (
        <>
          <Field label={`It made (${madeUnit})`} value={made} onChangeText={onMade} keyboardType="decimal-pad" />
          <Caption tone="muted">{"Came out more or less? Change it and the recipe's yield learns from it."}</Caption>
        </>
      ) : null}
      <Caption tone="muted" role="heading" style={styles.eyebrow}>LABEL</Caption>
      <LabelCard label={label} />
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const ds = useDs();
  return (
    <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
      <Body>{label}</Body>
      {strong ? <Body style={styles.value}>{value}</Body> : <Body tone="muted" style={styles.value}>{value}</Body>}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  tick: { width: 52, height: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  facts: { paddingVertical: 0 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  value: { flexShrink: 1, textAlign: 'right' },
  eyebrow: { letterSpacing: 0.6 },
});
