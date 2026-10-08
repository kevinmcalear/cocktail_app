import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Caption, DsText, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { convertPour, QUICK_UNITS, stepAmount, type WizardLine } from '@/lib/drinkWizard';
import { tidyAmount } from '@/lib/specDefaults';

import { WizardChip } from './WizardChrome';

interface LineRowProps {
  line: WizardLine;
  onChange: (change: Partial<WizardLine>) => void;
  onRemove: () => void;
  /** Tapping the name: swap it for another ingredient, keeping the amount. */
  onSwap: () => void;
}

/**
 * One spec line, everything in sight: the ingredient (tap to swap it), its
 * amount (type it, or − and + through the pours bartenders use), its unit
 * (tap to change) and remove. On a phone the controls sit under the name; on
 * a wider screen they share its line.
 */
export function LineRow({ line, onChange, onRemove, onSwap }: LineRowProps) {
  const ds = useDs();
  const [units, setUnits] = useState(false);
  const top = line.unit === 'top';
  const amountLabel = top ? 'Top' : line.amount ? `${line.amount} ${line.unit}` : `no amount, ${line.unit}`;
  return (
    <View role="listitem" style={[styles.wrap, { borderBottomColor: ds.c.line }]}>
      <View style={styles.row}>
        <IngredientThumb id={line.id} name={line.name} size={40} />
        <View style={styles.main}>
          <PressableScale
            onPress={onSwap}
            haptic={false}
            role="button"
            accessibilityLabel={`${line.name}, ${amountLabel}`}
            accessibilityHint="Swaps it for another ingredient"
            style={styles.name}
          >
            <Body numberOfLines={2}>{line.name}</Body>
            {line.id ? null : <Caption tone="muted">New, added when you save</Caption>}
          </PressableScale>
          <View style={styles.controls}>
            <View style={[styles.stepper, { backgroundColor: ds.c.raised }]}>
              {top ? (
                <DsText variant="spec" style={[styles.mono, styles.topLabel]}>
                  Top
                </DsText>
              ) : (
                <>
                  <Round icon="minus" label={`Less ${line.name}`} onPress={() => onChange({ amount: stepAmount(tidyAmount(line.amount), line.unit, -1) })} />
                  <TextInput
                    value={line.amount}
                    onChangeText={(amount) => onChange({ amount: amount.replace(/[^0-9.,/ ¼½¾⅓⅔⅛]/g, '') })}
                    onBlur={() => onChange({ amount: tidyAmount(line.amount) })}
                    keyboardType="numbers-and-punctuation"
                    returnKeyType="done"
                    selectTextOnFocus
                    placeholder="–"
                    placeholderTextColor={ds.c.faint}
                    aria-label={`Amount of ${line.name}`}
                    maxLength={8}
                    style={[styles.amount, type.spec, { fontFamily: fontFamilies.monoMedium, color: ds.c.ink }]}
                  />
                  <Round icon="plus" label={`More ${line.name}`} onPress={() => onChange({ amount: stepAmount(tidyAmount(line.amount), line.unit, 1) })} />
                </>
              )}
            </View>
            <PressableScale
              onPress={() => setUnits(!units)}
              haptic={false}
              role="button"
              aria-expanded={units}
              accessibilityLabel={`Unit: ${line.unit}`}
              accessibilityHint="Shows the units to pick from"
              style={[styles.unit, { borderColor: units ? ds.c.ink : ds.c.lineStrong }]}
            >
              <DsText variant="spec" style={styles.mono}>
                {line.unit}
              </DsText>
              <IconSymbol name={units ? 'chevron.up' : 'chevron.down'} size={12} color={ds.c.muted} />
            </PressableScale>
          </View>
        </View>
        <PressableScale onPress={onRemove} role="button" accessibilityLabel={`Remove ${line.name}`} style={styles.remove}>
          <IconSymbol name="xmark" size={16} color={ds.c.muted} />
        </PressableScale>
      </View>
      {units ? (
        <View role="radiogroup" accessibilityLabel={`Unit for ${line.name}`} style={styles.units}>
          {QUICK_UNITS.map((u) => (
            <WizardChip
              key={u}
              label={u}
              selected={line.unit === u}
              onPress={() => {
                // ml, cl and oz convert ("22.5" ml is "0.75" oz); other units keep the number.
                const n = parseFloat(tidyAmount(line.amount));
                const pour = Number.isFinite(n) ? convertPour(n, line.unit, u) : null;
                onChange(u === 'top' ? { unit: u, amount: '' } : pour?.unit === u ? pour : { unit: u });
                setUnits(false);
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Round({ icon, label, onPress }: { icon: 'minus' | 'plus'; label: string; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale onPress={onPress} role="button" accessibilityLabel={label} style={styles.step}>
      <IconSymbol name={icon} size={16} color={ds.c.ink} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: space.md, gap: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  // Name and controls wrap: two lines on a phone, one on a wide screen.
  main: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.md, rowGap: space.xs },
  name: { flexGrow: 1, flexBasis: 150, minHeight: layout.minTapTarget, justifyContent: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, height: layout.minTapTarget },
  step: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  amount: { width: 56, height: layout.minTapTarget, textAlign: 'center', padding: 0 },
  topLabel: { paddingHorizontal: space.xl },
  mono: { fontFamily: fontFamilies.monoMedium },
  unit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minWidth: 64,
    height: layout.minTapTarget,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  remove: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  units: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingLeft: 40 + space.md },
});
