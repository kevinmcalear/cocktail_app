import { useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Body, DsText, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { BOTTLE_UNITS, withBottleAmount, type LineBatch } from '@/lib/batchLines';
import type { WizardLine } from '@/lib/drinkWizard';

import { WizardChip } from './WizardChrome';

const POURS = ['ml', 'cl', 'oz'];

interface BatchBottleRowProps {
  batch: LineBatch;
  /** The line, and what's in the bottle of it (lib/batchLines bottleAmounts). */
  line: WizardLine;
  amount: number | null;
  unit: string;
  onBatch: (batch: LineBatch) => void;
}

/**
 * One line of what goes in the bottle, typed as it's measured into it (Kevin,
 * 24 Oct: 70 g of red miso, and the sheet wouldn't take it): in ml for a
 * pour, anything else (or to taste) with its unit picked under it. Every keystroke
 * works from the batch as it was when the field took focus, so nothing drifts.
 */
export function BatchBottleRow({ batch, line, amount, unit, onBatch }: BatchBottleRowProps) {
  const ds = useDs();
  const [text, setText] = useState<string | null>(null);
  const [units, setUnits] = useState(false);
  const base = useRef<LineBatch | null>(null);
  // A measured pour stays a pour: its unit is picked on the drink's line, not here.
  const measured = amount !== null && POURS.includes(unit);
  const shown = text ?? (amount === null ? '' : String(amount));
  const put = (n: number | null, u: string) => onBatch(withBottleAmount(base.current ?? batch, line.key, n, u));
  const number = (t: string) => {
    const n = parseFloat(t);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return (
    <View style={[styles.wrap, { borderBottomColor: ds.c.line }]}>
      <View style={styles.row}>
        <IngredientThumb id={line.id} name={line.name} size={32} />
        <Body style={styles.flex} numberOfLines={2}>
          {line.name}
        </Body>
        <TextInput
          value={shown}
          onFocus={() => {
            base.current = batch;
            setText(shown);
          }}
          onChangeText={(t) => {
            const clean = t.replace(/[^0-9.]/g, '');
            setText(clean);
            put(number(clean), unit);
          }}
          onBlur={() => {
            base.current = null;
            setText(null);
          }}
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'decimal-pad'}
          returnKeyType="done"
          selectTextOnFocus
          placeholder="to taste"
          placeholderTextColor={ds.c.faint}
          aria-label={`${line.name} in the bottle, ${unit}`}
          maxLength={7}
          style={[styles.amount, type.spec, { fontFamily: fontFamilies.monoMedium, color: ds.c.ink, backgroundColor: ds.c.raised }]}
        />
        {measured ? (
          <DsText variant="spec" color={ds.c.muted} style={styles.unitText}>
            ml
          </DsText>
        ) : (
          <PressableScale
            onPress={() => setUnits(!units)}
            haptic={false}
            role="button"
            aria-expanded={units}
            accessibilityLabel={`Unit for ${line.name}: ${unit}`}
            style={[styles.unit, { borderColor: units ? ds.c.ink : ds.c.lineStrong }]}
          >
            <DsText variant="spec" style={styles.mono}>
              {unit}
            </DsText>
            <IconSymbol name={units ? 'chevron.up' : 'chevron.down'} size={12} color={ds.c.muted} />
          </PressableScale>
        )}
      </View>
      {units && !measured ? (
        <View role="radiogroup" aria-label={`Unit for ${line.name}`} style={styles.units}>
          {['ml', ...BOTTLE_UNITS].map((u) => (
            <WizardChip
              key={u}
              label={u}
              selected={unit === u}
              onPress={() => {
                put(amount, u);
                setUnits(false);
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: space.sm, gap: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget },
  flex: { flex: 1, minWidth: 0 },
  amount: { width: 64, height: layout.minTapTarget, borderRadius: radius.control, textAlign: 'right', paddingHorizontal: space.sm },
  mono: { fontFamily: fontFamilies.monoMedium },
  unitText: { minWidth: 52, textAlign: 'center' },
  unit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, minWidth: 52, height: layout.minTapTarget, paddingHorizontal: space.sm, borderRadius: radius.pill, borderWidth: 1 },
  units: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2, paddingLeft: 32 + space.sm },
});
