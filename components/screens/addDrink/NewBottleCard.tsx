import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import type { NewBottle } from '@/lib/drinkWizard';
import { BOTTLE_KINDS, guessBottleKind, type BottleKind } from '@/lib/newBottle';

import { Eyebrow, WizardChip } from './WizardChrome';

interface NewBottleCardProps {
  name: string;
  bottle: NewBottle;
  venueName: string;
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
 * the name), how strong, its pack and pack price. It's one row for the
 * venue, made when the drink is saved; the line's cost counts it now. Who
 * brings it is the run sheet's question (Kevin, 26 Oct); a supplier a kept
 * draft already has still saves.
 */
export function NewBottleCard({ name, bottle, venueName, kindId, canCost, onChange, onAdd, onNameOnly }: NewBottleCardProps) {
  const ds = useDs();
  const guess = guessBottleKind(name);
  const set = (c: Partial<NewBottle>) => onChange({ ...bottle, ...c });
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
