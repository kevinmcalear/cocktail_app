import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import type { NewBottle } from '@/lib/drinkWizard';
import { BOTTLE_KINDS, guessBottleKind, type BottleKind } from '@/lib/newBottle';
import type { SupplierPick } from '@/lib/suppliers';

import { Eyebrow, WizardChip } from './WizardChrome';

interface NewBottleCardProps {
  name: string;
  bottle: NewBottle;
  venueName: string;
  /** The venue's suppliers, the suggested one first (lib/suppliers pickSuppliers); null leaves who brings it off the card (the phone wizard). */
  suppliers: SupplierPick | null;
  /** The kind row each choice of what it is saves as (lib/newBottle bottleKindRow). */
  kindId: (kind: BottleKind | null) => string | null;
  /** Shown with Costs: the pack price. */
  canCost: boolean;
  onChange: (bottle: NewBottle) => void;
  onAdd: () => void;
  onNameOnly: () => void;
}

/**
 * A bottle you buy that isn't here yet, filled in under its own line on the
 * desktop page (board make-create-desktop, step 5): what it is (guessed from
 * the name), how strong, who brings it, its pack and pack price. It's one row
 * for the venue, made when the drink is saved; the line's cost counts it now.
 */
export function NewBottleCard({ name, bottle, venueName, suppliers, kindId, canCost, onChange, onAdd, onNameOnly }: NewBottleCardProps) {
  const ds = useDs();
  const [adding, setAdding] = useState(false);
  const guess = guessBottleKind(name);
  const set = (c: Partial<NewBottle>) => onChange({ ...bottle, ...c });
  const typed = bottle.supplier && !bottle.supplier.id ? bottle.supplier.name : '';
  return (
    <View role="group" aria-label={`New bottle: ${name}`} style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
      <View style={styles.head}>
        <Body>{`New bottle: ${name}`}</Body>
        <Caption tone="muted">{`One row for everyone at ${venueName}. We checked, there isn’t one yet.`}</Caption>
      </View>

      <Eyebrow>What is it</Eyebrow>
      <View role="radiogroup" accessibilityLabel={`What ${name} is`} style={styles.chips}>
        {BOTTLE_KINDS.map((k) => (
          <WizardChip
            key={k.id}
            label={k.label}
            selected={bottle.kind === k.id}
            suggested={k.id === guess}
            onPress={() => {
              const kind = bottle.kind === k.id ? null : k.id;
              set({ kind, kindId: kindId(kind) });
            }}
          />
        ))}
      </View>
      {bottle.kind && bottle.kind === guess ? <Caption tone="muted">From the name. Change it if it’s something else.</Caption> : null}

      {suppliers ? (
        <>
          <Eyebrow>Who brings it</Eyebrow>
          <View role="radiogroup" accessibilityLabel={`Who brings ${name}`} style={styles.chips}>
            {suppliers.choices.map((s) => (
              <WizardChip
                key={s.id}
                label={s.id === suppliers.suggested ? `${s.name}, suggested` : s.name}
                selected={bottle.supplier?.id === s.id}
                suggested={s.id === suppliers.suggested}
                onPress={() => set({ supplier: bottle.supplier?.id === s.id ? null : { id: s.id, name: s.name } })}
              />
            ))}
            {adding || typed ? null : <WizardChip label="New supplier" add kind="button" onPress={() => setAdding(true)} />}
          </View>
          {adding || typed ? (
            <Field label="A new supplier’s name" value={typed} onChangeText={(t) => set({ supplier: t ? { name: t } : null })} autoFocus={adding && !typed} maxLength={80} placeholder="Northside Liquor" />
          ) : null}
          {suppliers.why ? <Caption tone="muted">{`Suggested because ${suppliers.why}.`}</Caption> : null}
        </>
      ) : null}

      <View style={styles.fields}>
        <View style={styles.field}>
          <Field label="ABV" value={bottle.abv} onChangeText={(abv) => set({ abv: abv.replace(/[^0-9.,]/g, '') })} keyboardType="decimal-pad" maxLength={5} trailing={<Caption tone="muted" style={styles.unit}>%</Caption>} />
        </View>
        <View style={styles.field}>
          <Field label="Pack size" value={bottle.packAmount} onChangeText={(packAmount) => set({ packAmount: packAmount.replace(/[^0-9.,]/g, '') })} keyboardType="decimal-pad" maxLength={7} placeholder="700" trailing={<Caption tone="muted" style={styles.unit}>ml</Caption>} />
        </View>
        {canCost ? (
          <View style={styles.field}>
            <Field label="Pack price" value={bottle.packPrice} onChangeText={(packPrice) => set({ packPrice: packPrice.replace(/[^0-9.,]/g, '') })} keyboardType="decimal-pad" maxLength={9} />
          </View>
        ) : null}
      </View>
      <Caption tone="muted">{`Set once for ${venueName}: every drink with ${name} uses it.`}</Caption>

      <View style={styles.buttons}>
        <Button label={`Add ${name}`} onPress={onAdd} />
        <Button label="Just the name for now" variant="secondary" onPress={onNameOnly} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginLeft: 40 + space.md, marginBottom: space.md, gap: space.md, padding: space.lg, borderRadius: radius.card, borderWidth: 1 },
  head: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  field: { flexGrow: 1, flexBasis: 140 },
  unit: { paddingRight: space.md },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
