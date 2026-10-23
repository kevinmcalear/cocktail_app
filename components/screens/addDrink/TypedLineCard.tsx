import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { typedUnit, type WizardPick } from '@/lib/drinkWizard';
import type { HouseReading } from '@/lib/makeItHouse';
import type { TypedPour } from '@/lib/paste';
import { nameFor } from '@/lib/techniques/template';
import { getPreferredUnit } from '@/store/useSettingsStore';

import type { CatalogIngredient } from './IngredientSearch';
import { WizardChip } from './WizardChrome';

interface TypedLineCardProps {
  reading: HouseReading<CatalogIngredient>;
  /** The pour typed before it ("60 ml"), if any. */
  pour: TypedPour | null;
  /** Looks right (check false): the line, made house straight away. Check it: the line, then "What did you do to it?". */
  onAdd: (bottle: WizardPick, check: boolean) => void;
}

/**
 * "Here's what I read" for a line written the way a spec says it, "60 ml
 * coconut fat-washed bacardi": the amount, the way, the "with what" and which
 * bottle, before anything is added (canvas make-create-finish-oil, step 1).
 */
export function TypedLineCard({ reading, pour, onAdd }: TypedLineCardProps) {
  const ds = useDs();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const { technique, adjunct, bottles, base } = reading;
  const bottle = bottles.find((b) => b.id === pickedId) ?? bottles[0];
  const pick = { id: bottle.id, name: bottle.name ?? base };
  const made = nameFor(technique, { base: pick.name, adjunct });
  // The unit the line will get, as add does it: from the bottle picked.
  const amount = pour ? `${pour.amount} ${typedUnit(pick.name, pour.unit, getPreferredUnit())}` : null;
  const parts: [string, string][] = [...(amount ? [['Amount', amount] as [string, string]] : []), ['Way', technique.name], ['With', adjunct ?? 'You pick it next']];
  return (
    <View role="group" aria-label="What it read" style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.accentText }]}>
      <Caption tone="accent">HERE’S WHAT I READ</Caption>
      <View style={styles.parts}>
        {parts.map(([label, value]) => (
          <View key={label} style={[styles.part, { backgroundColor: ds.c.raised }]}>
            <Caption tone="muted">{label}</Caption>
            <Body numberOfLines={2}>{value}</Body>
          </View>
        ))}
      </View>
      {bottles.length > 1 ? (
        <View style={styles.which}>
          <Caption tone="muted">{`Which ${base}?`}</Caption>
          <View role="radiogroup" aria-label={`Which ${base}`} style={styles.chips}>
            {bottles.map((b) => (
              <WizardChip key={b.id} label={b.name ?? base} selected={b.id === bottle.id} onPress={() => setPickedId(b.id)} />
            ))}
          </View>
        </View>
      ) : null}
      <Body>{`Adds ${made}, a house prep with the ${technique.name.toLowerCase()} recipe filled in.`}</Body>
      <View style={styles.buttons}>
        <Button label="Looks right" size="sm" accessibilityLabel={`Looks right: add ${made}`} onPress={() => onAdd(pick, false)} />
        <Button label="Check it" size="sm" variant="secondary" accessibilityLabel={`Check how ${pick.name} was made`} onPress={() => onAdd(pick, true)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: space.lg, borderRadius: radius.control, borderWidth: 1 },
  parts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  part: { flexGrow: 1, flexBasis: 90, gap: space.xs, paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.control },
  which: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
