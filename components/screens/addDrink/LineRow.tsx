import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Button, DsText, PressableScale, useDs } from '@/components/ds';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { amountLabel, QUICK_UNITS, stepAmount, type WizardLine } from '@/lib/drinkWizard';

import { WizardChip } from './WizardChrome';

interface LineRowProps {
  line: WizardLine;
  /** Open: type an exact amount, pick the unit, or remove the line. */
  open: boolean;
  onToggle: () => void;
  onChange: (change: Partial<WizardLine>) => void;
  onRemove: () => void;
}

/** One spec line: its name and a − amount + stepper; tap either to open the rest. */
export function LineRow({ line, open, onToggle, onChange, onRemove }: LineRowProps) {
  const ds = useDs();
  const top = line.unit === 'top';
  const shown = amountLabel(line) || `– ${line.unit}`;
  return (
    <View style={[styles.wrap, { borderBottomColor: ds.c.line }]}>
      <View style={styles.row}>
        <PressableScale onPress={onToggle} haptic={false} aria-expanded={open} accessibilityLabel={`${line.name}, ${shown}`} accessibilityHint="Shows the amount, unit and remove" style={styles.name}>
          <Body numberOfLines={2}>{line.name}</Body>
        </PressableScale>
        <View style={[styles.stepper, { backgroundColor: ds.c.raised }]}>
          {top ? null : <Step label="−" name={`Less ${line.name}`} onPress={() => onChange({ amount: stepAmount(line.amount, line.unit, -1) })} />}
          <PressableScale onPress={onToggle} haptic={false} accessibilityLabel={`Amount: ${shown}`} style={styles.amount}>
            <DsText variant="spec" style={styles.mono} numberOfLines={1}>
              {shown}
            </DsText>
          </PressableScale>
          {top ? null : <Step label="+" name={`More ${line.name}`} onPress={() => onChange({ amount: stepAmount(line.amount, line.unit, 1) })} />}
        </View>
      </View>
      {open ? (
        <View style={styles.panel}>
          <View style={styles.exact}>
            {top ? null : (
              <TextInput
                value={line.amount}
                onChangeText={(amount) => onChange({ amount: amount.replace(/[^0-9.,]/g, '') })}
                keyboardType="decimal-pad"
                placeholder="Amount"
                placeholderTextColor={ds.c.faint}
                aria-label={`Amount of ${line.name}`}
                style={[styles.input, type.spec, { fontFamily: fontFamilies.monoMedium, color: ds.c.ink, backgroundColor: ds.c.raised, borderColor: ds.c.line }]}
              />
            )}
            <Button label="Remove" variant="ghost" icon="trash" onPress={onRemove} />
          </View>
          <View role="radiogroup" accessibilityLabel={`Unit for ${line.name}`} style={styles.units}>
            {QUICK_UNITS.map((u) => (
              <WizardChip key={u} label={u} selected={line.unit === u} onPress={() => onChange(u === 'top' ? { unit: u, amount: '' } : { unit: u })} />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Step({ label, name, onPress }: { label: string; name: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={name} style={styles.step}>
      <DsText variant="headline">{label}</DsText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: space.sm, gap: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 },
  name: { flex: 1, minHeight: layout.minTapTarget, justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, height: layout.minTapTarget },
  step: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  amount: { minWidth: 64, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xs },
  mono: { fontFamily: fontFamilies.monoMedium },
  panel: { gap: space.md, paddingBottom: space.sm },
  exact: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  input: { width: 120, minHeight: layout.minTapTarget, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: space.md },
  units: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
