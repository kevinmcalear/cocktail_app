import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, Button, Caption, DsText, Field, IngredientThumb, PressableScale, Sheet, SheetScrollView, useDs, useSheetClose } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { BOTTLE_SIZES } from '@/lib/batch';
import { bottleMl, drinksPerBottle, withBottle } from '@/lib/batchLines';
import { perDrink, type WizardLine } from '@/lib/drinkWizard';
import { prepAmounts } from '@/lib/prepKinds';
import { tidyAmount } from '@/lib/specDefaults';

import { Eyebrow, WizardChip } from './WizardChrome';

interface BatchSheetProps {
  /** The batch line; null when closed. */
  line: WizardLine | null;
  drinkName: string;
  /** Just made by a drop: "New batch". */
  fresh: boolean;
  /** A line dropped on the batch: asked once whether it goes in the bottle. */
  ask: WizardLine | null;
  onSave: (name: string, bottle: number) => void;
  onSplit: () => void;
  onAddIn: () => void;
  onClose: () => void;
}

/**
 * A batch, per bottle (board eddie-oct22-wave2, fix 9): its name, the bottle
 * size, what goes in one bottle by the drink's ratio, how many drinks that
 * makes and what the drink pours. The per-drink amounts wait behind a tap.
 * Split puts the lines back. A dialog in the middle on the web.
 */
export function BatchSheet(props: BatchSheetProps) {
  // Kept while it slides away, so the sheet doesn't empty as it goes.
  const [shown, setShown] = useState(props.line);
  if (props.line && props.line !== shown) setShown(props.line);
  return (
    <BackbarTheme>
      <Sheet visible={!!props.line} onClose={props.onClose} accessibilityLabel="Batch" ground keyboard>
        {shown?.prep ? <BatchBody key={`${shown.key}:${props.ask?.key ?? ''}`} {...props} line={shown} /> : null}
      </Sheet>
    </BackbarTheme>
  );
}

function BatchBody({ line, drinkName, fresh, ask, onSave, onSplit, onAddIn }: BatchSheetProps & { line: WizardLine }) {
  const ds = useDs();
  const close = useSheetClose();
  const prep = line.prep!;
  const [name, setName] = useState(line.name);
  const [bottle, setBottle] = useState(bottleMl(prep));
  const [other, setOther] = useState(!(BOTTLE_SIZES as readonly number[]).includes(bottleMl(prep)));
  const [perOpen, setPerOpen] = useState(false);
  const recipe = withBottle(prep, bottle);
  const drinks = drinksPerBottle(recipe, line);
  const pour = `${tidyAmount(line.amount)} ${line.unit}`.trim();
  const drink = drinkName.trim() || 'the drink';
  const row = (key: string, label: string, amount: string, id?: string | null) => (
    <View key={key} style={[styles.row, { borderBottomColor: ds.c.line }]}>
      {id !== undefined ? <IngredientThumb id={id} name={label} size={32} /> : null}
      <Body style={styles.flex}>{label}</Body>
      <DsText variant="spec" style={styles.mono}>
        {amount}
      </DsText>
    </View>
  );

  return (
    <SheetScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Eyebrow>{`${fresh ? 'New batch' : 'Batch'} · from ${drink}`}</Eyebrow>
      {ask ? (
        <View style={[styles.ask, { backgroundColor: ds.c.surface, borderColor: ds.accentFill.fill }]}>
          <Body>{`Put ${ask.name.toLowerCase()} in the bottle?`}</Body>
          <View style={styles.buttons}>
            <Button label="Add it" onPress={onAddIn} />
            <Button label="Keep it out" variant="secondary" onPress={close} />
          </View>
        </View>
      ) : null}
      <Field label="Name" value={name} onChangeText={setName} maxLength={80} />
      <View style={styles.bottle}>
        <Caption tone="muted">One bottle</Caption>
        <View role="radiogroup" accessibilityLabel="Bottle size" style={styles.chips}>
          {BOTTLE_SIZES.map((ml) => (
            <WizardChip
              key={ml}
              label={ml >= 1000 ? `${ml / 1000} L` : `${ml} ml`}
              selected={!other && bottle === ml}
              onPress={() => {
                setOther(false);
                setBottle(ml);
              }}
            />
          ))}
          <WizardChip label="Other" selected={other} onPress={() => setOther(true)} />
        </View>
      </View>
      {other ? (
        <Field
          label="Bottle, in ml"
          value={String(bottle)}
          onChangeText={(t) => setBottle(Math.min(20000, Number(t.replace(/[^0-9]/g, '')) || 0))}
          keyboardType="number-pad"
          maxLength={5}
        />
      ) : null}
      <View>
        <Caption tone="muted">In the bottle</Caption>
        {prepAmounts(recipe).map(({ line: l, amount }) => row(l.key, l.name, amount === null ? '' : `${amount} ml`, l.id))}
        <View style={[styles.row, { borderBottomColor: ds.c.line }]}>
          <Body style={styles.flex}>{`Makes ${bottle} ml`}</Body>
          {drinks ? <Caption tone="muted">{`about ${drinks} drinks`}</Caption> : null}
        </View>
      </View>
      <View style={[styles.pour, { backgroundColor: ds.c.surface }]}>
        <Body style={styles.flex}>{`In ${drink}`}</Body>
        <DsText variant="spec" style={styles.mono}>
          {pour}
        </DsText>
      </View>
      <PressableScale role="button" aria-expanded={perOpen} accessibilityLabel="Per drink amounts" onPress={() => setPerOpen(!perOpen)} haptic={false} style={styles.toggle}>
        <Body>Per drink amounts</Body>
        <IconSymbol name={perOpen ? 'chevron.up' : 'chevron.down'} size={14} color={ds.c.muted} />
        <Caption tone="muted" style={styles.flex}>
          only if you want them
        </Caption>
      </PressableScale>
      {perOpen ? (
        <View>
          {perDrink([line]).map((l) => row(l.key, l.name, `${l.amount} ${l.unit}`))}
          <Caption tone="muted" style={styles.note}>{`${pour} of the batch is this. The drink page never shows it unless someone opens it here.`}</Caption>
        </View>
      ) : null}
      <View style={styles.buttons}>
        <Button label="Save batch" onPress={() => onSave(name.trim() || line.name, bottle || bottleMl(prep))} disabled={!bottle} />
        <Button label="Split back into lines" variant="secondary" onPress={onSplit} />
      </View>
    </SheetScrollView>
  );
}

/** A batch line's mark in the drink: a bottle, not a drawing of one ingredient. */
export function BatchMark() {
  const ds = useDs();
  return (
    <View aria-hidden style={[styles.mark, { backgroundColor: ds.c.raised }]}>
      <IconSymbol name="flask" size={22} color={ds.c.ink} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.xl, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.lg },
  flex: { flex: 1, minWidth: 0 },
  ask: { gap: space.md, borderWidth: 2, borderRadius: radius.control, padding: space.md },
  bottle: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  mono: { fontFamily: fontFamilies.monoMedium },
  pour: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget, paddingHorizontal: space.md, borderRadius: radius.control },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget },
  note: { paddingTop: space.sm },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  mark: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
