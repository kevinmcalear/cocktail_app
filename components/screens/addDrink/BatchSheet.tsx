import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackbarTheme, Body, Button, Caption, DsText, Field, PressableScale, Sheet, SheetScrollView, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { BATCH_BOTTLES, bottleAmounts, drinkMl, drinksPerBottle, withBatch } from '@/lib/batchLines';
import { amountLabel, type WizardLine } from '@/lib/drinkWizard';
import { yieldText } from '@/lib/libraryFilters';

import { BatchBottleRow } from './BatchBottleRow';
import { WizardChip } from './WizardChrome';

const ml = (n: number) => `${Math.round(n * 10) / 10} ml`;

interface BatchSheetProps {
  /** The batch line (lib/batchLines); null when closed. */
  line: WizardLine | null;
  drinkName: string;
  onChange: (line: WizardLine) => void;
  /** Save batch: done, with the toast. */
  onSave: () => void;
  onSplit: () => void;
  onClose: () => void;
}

/**
 * The batch, per bottle (board fix 9, step 2): its name, the bottle (750 ml
 * to start), what goes in it worked out from the drink's own amounts, how
 * many drinks it makes and what one drink takes. The per-drink amounts stay
 * folded away. A centred dialog on the web (Sheet).
 */
export function BatchSheet({ line, drinkName, onChange, onSave, onSplit, onClose }: BatchSheetProps) {
  return (
    <BackbarTheme>
      <Sheet visible={!!line?.batch} onClose={onClose} accessibilityLabel={`Batch from ${drinkName || 'this drink'}`} ground keyboard>
        {line?.batch ? <Body_ key={line.key} line={line} drinkName={drinkName} onChange={onChange} onSave={onSave} onSplit={onSplit} /> : null}
      </Sheet>
    </BackbarTheme>
  );
}

function Body_({ line, drinkName, onChange, onSave, onSplit }: Omit<BatchSheetProps, 'onClose'> & { line: WizardLine }) {
  const ds = useDs();
  const batch = line.batch!;
  // Other: picked, or a bottle the amounts typed in it add up to.
  const [picked, setOther] = useState(false);
  const other = picked || !(BATCH_BOTTLES as readonly number[]).includes(batch.bottleMl);
  const [otherText, setOtherText] = useState<string | null>(null);
  const [perDrink, setPerDrink] = useState(false);
  const bottle = (bottleMl: number) => onChange(withBatch(line, { ...batch, bottleMl }));
  const per = drinkMl(batch.lines);
  const drinks = drinksPerBottle(batch.bottleMl, per);
  const from = drinkName.trim() || 'this drink';
  return (
    <SheetScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Caption tone="muted" style={styles.eyebrow}>{`New batch · from ${from}`.toUpperCase()}</Caption>
      <Field label="Name" value={line.name} onChangeText={(name) => onChange({ ...line, name })} maxLength={80} returnKeyType="done" />
      <View style={styles.group}>
        <Caption tone="muted">One bottle</Caption>
        <View role="radiogroup" aria-label="Bottle size" style={styles.chips}>
          {BATCH_BOTTLES.map((b) => (
            <WizardChip
              key={b}
              label={yieldText(b, 'ml') ?? ml(b)}
              selected={!other && batch.bottleMl === b}
              onPress={() => {
                setOther(false);
                bottle(b);
              }}
            />
          ))}
          <WizardChip label="Other" selected={other} onPress={() => setOther(true)} />
        </View>
        {other ? (
          <Field
            label="Millilitres in the bottle"
            value={otherText ?? (picked && (BATCH_BOTTLES as readonly number[]).includes(batch.bottleMl) ? '' : String(batch.bottleMl))}
            onBlur={() => setOtherText(null)}
            autoFocus={picked}
            keyboardType="number-pad"
            maxLength={5}
            onChangeText={(t) => {
              const digits = t.replace(/[^0-9]/g, '');
              setOtherText(digits);
              const n = Number(digits);
              // A bottle big enough for one drink, and no bigger than a keg: anything else waits for a real number.
              if (n >= Math.max(per, 50) && n <= 20000) bottle(n);
            }}
          />
        ) : null}
      </View>

      <Caption tone="muted" style={styles.eyebrow}>IN THE BOTTLE</Caption>
      <View>
        {bottleAmounts(batch).map(({ line: l, amount, unit }) => (
          <BatchBottleRow key={l.key} batch={batch} line={l} amount={amount} unit={unit} onBatch={(b) => onChange(withBatch(line, b))} />
        ))}
        <View style={styles.makes}>
          <Body style={styles.strong}>{`Makes ${yieldText(batch.bottleMl, 'ml')}`}</Body>
          <Caption tone="muted">{drinks === 1 ? 'about 1 drink' : `about ${drinks} drinks`}</Caption>
        </View>
      </View>
      <View style={[styles.inDrink, { backgroundColor: ds.c.raised }]}>
        <Body style={styles.flex}>{`In ${from}`}</Body>
        <DsText variant="spec">{amountLabel(line)}</DsText>
      </View>

      <PressableScale role="button" aria-expanded={perDrink} accessibilityLabel="What one drink gets" onPress={() => setPerDrink(!perDrink)} haptic={false} style={styles.toggle}>
        <Body style={styles.strong} numberOfLines={1}>
          What one drink gets
        </Body>
        <IconSymbol name={perDrink ? 'chevron.up' : 'chevron.down'} size={14} color={ds.c.muted} />
        <Caption tone="muted" style={styles.flex} numberOfLines={1}>
          from the bottle
        </Caption>
      </PressableScale>
      {perDrink ? (
        <View>
          {batch.lines.map((l) => (
            <View key={l.key} style={[styles.row, { borderBottomColor: ds.c.line }]}>
              <Body style={styles.flex}>{l.name}</Body>
              <DsText variant="spec" color={ds.c.muted}>
                {amountLabel(l) || 'no amount'}
              </DsText>
            </View>
          ))}
          <Caption tone="muted" style={styles.note}>{`${amountLabel(line)} of the batch is this. The drink page never shows it unless someone opens it here.`}</Caption>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button label="Save batch" onPress={onSave} />
        <Button label="Split back into lines" variant="ghost" onPress={onSplit} />
      </View>
    </SheetScrollView>
  );
}

interface BatchAddSheetProps {
  /** The line dropped on a batch, and the batch; null when closed. */
  adding: { line: WizardLine; batch: WizardLine } | null;
  onAdd: () => void;
  onClose: () => void;
}

/** Dropping a line on a batch asks once: "Put lime juice in the bottle?" Juice is the usual thing bars keep out. */
export function BatchAddSheet({ adding, onAdd, onClose }: BatchAddSheetProps) {
  const name = adding?.line.name.toLowerCase() ?? '';
  return (
    <BackbarTheme>
      <Sheet visible={!!adding} onClose={onClose} accessibilityLabel={`Put ${name} in the bottle?`} ground>
        <View style={styles.body}>
          <Caption tone="muted" style={styles.eyebrow}>{(adding?.batch.name ?? '').toUpperCase()}</Caption>
          <Title role="heading">{`Put ${name} in the bottle?`}</Title>
          <View style={styles.actions}>
            <Button label="Add it" onPress={onAdd} />
            <Button label="Keep it out" variant="secondary" onPress={onClose} />
          </View>
        </View>
      </Sheet>
    </BackbarTheme>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl, gap: space.lg },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1 },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1, minWidth: 0 },
  makes: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: space.sm },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  inDrink: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: space.md, borderRadius: radius.control },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget },
  note: { paddingTop: space.sm },
  actions: { gap: space.xs },
});
