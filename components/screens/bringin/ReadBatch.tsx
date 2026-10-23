import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { BackbarTheme, Body, Button, Caption, DsText, Field, IngredientThumb, PressableScale, Sheet, SheetScrollView, Title, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space } from '@/constants/tokens';
import { bottleAmounts } from '@/lib/batchLines';
import { amountLabel, type WizardLine } from '@/lib/drinkWizard';
import { yieldText } from '@/lib/libraryFilters';
import type { ReadFile } from '@/lib/readAnything';
import type { ReadBatch as Batch } from '@/supabase/functions/_shared/anythingRead';

import { WizardChip } from '../addDrink/WizardChrome';
import { PagePicture } from './PagePicture';
import { FromYourFile } from './RecipeSource';

/** "One 750 ml bottle: Mezcal 450 ml, Cynar 300 ml". */
export function bottleLine(line: WizardLine): string {
  if (!line.batch) return '';
  const parts = bottleAmounts(line.batch).map(({ line: l, amount, unit }) => (amount === null ? l.name : `${l.name} ${amount} ${unit}`));
  return `One ${yieldText(line.batch.bottleMl, 'ml')} bottle: ${parts.join(', ')}`;
}

/**
 * The drink's batch line, read from the file (board eddie-oct22-wave2, Fix
 * 10, step 1): its name, "Batch read from your file", what one drink pours,
 * the bottle's recipe under it to check against the page, See the batch and
 * Keep as separate lines. Once an earlier drink saved it, it says so.
 */
export function ReadBatchRow({ line, made, onOpen, onSeparate }: { line: WizardLine; made: boolean; onOpen: () => void; onSeparate: () => void }) {
  const ds = useDs();
  return (
    <View role="listitem" style={[styles.card, { backgroundColor: ds.c.surface, borderColor: ds.accentText }]}>
      <View style={styles.head}>
        <View aria-hidden style={[styles.thumb, { backgroundColor: ds.c.paper }]}>
          <IconSymbol name="flask" size={20} color={ds.c.sketchInk} />
        </View>
        <View style={styles.flex}>
          <Body style={styles.strong}>{line.name}</Body>
          <Caption tone="accent">{made ? 'Saved with an earlier drink, so this one uses it' : 'Batch read from your file'}</Caption>
        </View>
        <DsText variant="spec" color={ds.c.muted}>
          {amountLabel(line)}
        </DsText>
      </View>
      {line.batch ? (
        <Caption tone="muted" style={styles.indent}>
          {bottleLine(line)}
        </Caption>
      ) : null}
      <View style={[styles.links, styles.indent]}>
        {line.batch ? <TextLink label="See the batch" onPress={onOpen} /> : null}
        <TextLink label="Keep as separate lines" muted onPress={onSeparate} />
      </View>
    </View>
  );
}

function TextLink({ label, muted, onPress }: { label: string; muted?: boolean; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" accessibilityLabel={label} onPress={onPress} haptic={false} style={styles.link}>
      <Caption color={muted ? ds.c.muted : ds.c.ink} style={styles.strong}>
        {label}
      </Caption>
    </PressableScale>
  );
}

const BOTTLES = [750, 1000];

interface ReadBatchSheetProps {
  /** The batch line (lib/bringInDraft readBatchLine); null when closed. */
  line: WizardLine | null;
  batch: Batch | null | undefined;
  drinkName: string;
  files: ReadFile[];
  onBottle: (ml: number) => void;
  onSeparate: () => void;
  onClose: () => void;
}

/**
 * The batch, checked against the page (Fix 10, step 2): its name, the bit of
 * the page it was read from (tap to see it bigger, here in the sheet), the
 * bottle, what goes in it and what one drink pours. Looks right, or Keep as
 * separate lines. A centred dialog on the web (Sheet).
 */
export function ReadBatchSheet(props: ReadBatchSheetProps) {
  const { line, drinkName, onClose } = props;
  return (
    <BackbarTheme>
      <Sheet visible={!!line?.batch} onClose={onClose} accessibilityLabel={`Batch for ${drinkName || 'this drink'}`} ground keyboard>
        {line?.batch ? <SheetBody key={line.key} {...props} line={line} /> : null}
      </Sheet>
    </BackbarTheme>
  );
}

function SheetBody({ line, batch, drinkName, files, onBottle, onSeparate, onClose }: ReadBatchSheetProps & { line: WizardLine }) {
  const ds = useDs();
  const { width, height } = useWindowDimensions();
  const bottleMl = line.batch!.bottleMl;
  const [other, setOther] = useState(!BOTTLES.includes(bottleMl));
  const [otherText, setOtherText] = useState(other ? String(bottleMl) : '');
  const [bigger, setBigger] = useState(false);
  const file = batch?.at ? (files[batch.at.page] ?? null) : null;
  return (
    <SheetScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Caption tone="muted" style={styles.eyebrow}>
        BATCH · READ FROM YOUR FILE
      </Caption>
      <Title role="heading">{line.name}</Title>
      {file && batch?.at ? (
        <FromYourFile
          file={file}
          box={batch.at.box}
          title={batch.heading ? `From “${batch.heading}”` : undefined}
          words={batch.lines.map((l) => `${l.amount ?? ''} ${l.ingredient}`.trim()).join('\n')}
          page={files.length > 1 ? batch.at.page + 1 : null}
          onLook={() => setBigger(!bigger)}
        />
      ) : null}
      {bigger && file && batch?.at ? <PagePicture file={file} width={Math.min(width, 560) - space.xxl * 2} maxHeight={height * 0.5} marks={[{ box: batch.at.box, dashed: false }]} /> : null}
      <View style={styles.group}>
        <Caption tone="muted">One bottle</Caption>
        <View role="radiogroup" aria-label="Bottle size" style={styles.chips}>
          {BOTTLES.map((b) => (
            <WizardChip
              key={b}
              label={yieldText(b, 'ml') ?? `${b} ml`}
              selected={!other && bottleMl === b}
              onPress={() => {
                setOther(false);
                onBottle(b);
              }}
            />
          ))}
          <WizardChip label="Other" selected={other} onPress={() => setOther(true)} />
        </View>
        {other ? (
          <Field
            label="Millilitres in the bottle"
            value={otherText}
            keyboardType="number-pad"
            maxLength={5}
            onChangeText={(t) => {
              const digits = t.replace(/[^0-9]/g, '');
              setOtherText(digits);
              const n = Number(digits);
              // As the batch sheet: a bottle big enough for a drink, no bigger than a keg.
              if (n >= 50 && n <= 20000) onBottle(n);
            }}
          />
        ) : null}
      </View>
      <Caption tone="muted" style={styles.eyebrow}>
        IN THE BOTTLE
      </Caption>
      <View>
        {/* By place: the lines are made fresh from the reading each time. */}
        {bottleAmounts(line.batch!).map(({ line: l, amount, unit }, i) => (
          <View key={i} style={[styles.row, { borderBottomColor: ds.c.line }]}>
            <IngredientThumb id={l.id} name={l.name} size={32} />
            <Body style={styles.flex}>{l.name}</Body>
            <DsText variant="spec" color={ds.c.muted}>
              {amount === null ? 'to taste' : `${amount} ${unit}`}
            </DsText>
          </View>
        ))}
      </View>
      <View style={[styles.inDrink, { backgroundColor: ds.c.raised }]}>
        <Body style={styles.flex}>{`In ${drinkName.trim() || 'this drink'}`}</Body>
        <DsText variant="spec">{amountLabel(line)}</DsText>
      </View>
      <Caption tone="muted">Saved as a house prep when you save the import, like a batch you made by hand.</Caption>
      <View style={styles.actions}>
        <Button label="Looks right" size="lg" onPress={onClose} />
        <Button label="Keep as separate lines" variant="ghost" onPress={onSeparate} />
      </View>
    </SheetScrollView>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, padding: space.md, marginHorizontal: -space.md, borderRadius: radius.card, borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: { width: 36, height: 36, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  indent: { paddingLeft: 36 + space.md },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  link: { minHeight: layout.minTapTarget, justifyContent: 'center' },
  body: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxl, gap: space.lg },
  eyebrow: { fontFamily: fontFamilies.mono, letterSpacing: 1 },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth },
  inDrink: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: space.md, borderRadius: radius.control },
  actions: { gap: space.xs },
});
