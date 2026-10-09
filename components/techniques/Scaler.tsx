import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Caption, Chip, Spec, Surface, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { formatDose, scaleParts, type Technique } from '@/lib/techniques';

/** "How much are you making?": the parts for any amount of the base, small doses to 0.01 g. */
export function Scaler({ base, parts }: { base: NonNullable<Technique['base']>; parts: NonNullable<Technique['parts']> }) {
  const ds = useDs();
  const [amount, setAmount] = useState(base.amounts[Math.min(1, base.amounts.length - 1)]);
  const [typed, setTyped] = useState('');
  const n = typed.trim() ? Number(typed.replace(',', '.')) : amount;
  const lines = scaleParts(parts, n);
  const unitLabel = base.unit === 'g' ? 'g' : 'ml';

  return (
    <Surface style={styles.card}>
      <Caption tone="muted">{`HOW MUCH ${base.name.toUpperCase()}?`}</Caption>
      <View style={styles.chips}>
        {base.amounts.map((a) => (
          <Chip
            key={a}
            label={`${a >= 1000 ? `${a / 1000} ${base.unit === 'g' ? 'kg' : 'L'}` : `${a} ${unitLabel}`}`}
            selected={!typed.trim() && amount === a}
            onPress={() => {
              setTyped('');
              setAmount(a);
            }}
          />
        ))}
        <View style={[styles.custom, { borderColor: typed.trim() ? ds.c.ink : ds.c.lineStrong }]}>
          <TextInput
            value={typed}
            onChangeText={setTyped}
            placeholder="Other"
            placeholderTextColor={ds.c.muted}
            keyboardType="decimal-pad"
            aria-label={`Amount of ${base.name.toLowerCase()} in ${unitLabel}`}
            maxLength={6}
            style={[styles.input, type.body, { fontFamily: fontFamilies.body, color: ds.c.ink }]}
          />
          <Caption tone="muted">{unitLabel}</Caption>
        </View>
      </View>
      {lines.length ? (
        <View role="list" style={styles.lines}>
          {[{ name: base.name, amount: n, unit: base.unit }, ...lines].map((l) => (
            <View key={l.name} role="listitem" style={[styles.line, { borderBottomColor: ds.c.line }]}>
              <Body style={styles.flex}>{l.name}</Body>
              <Spec>{`${formatDose(l.amount)} ${l.unit}`}</Spec>
            </View>
          ))}
        </View>
      ) : (
        <Body tone="muted">Type an amount to see what goes in.</Body>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  custom: { flexDirection: 'row', alignItems: 'center', gap: space.xs, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, minHeight: layout.minTapTarget },
  input: { width: 64, minHeight: layout.minTapTarget },
  lines: { gap: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
});
