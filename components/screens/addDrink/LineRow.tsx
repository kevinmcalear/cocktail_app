import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Body, Caption, DsText, IngredientThumb, PressableScale, useBreakpoint, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { convertPour, QUICK_UNITS, stepAmount, type WizardLine } from '@/lib/drinkWizard';
import { leadText } from '@/lib/prepKinds';
import { tidyAmount } from '@/lib/specDefaults';
import { techniqueById } from '@/lib/techniques';

import { LineGrip } from './DragRow';
import { WizardChip } from './WizardChrome';

interface LineRowProps {
  line: WizardLine;
  onChange: (change: Partial<WizardLine>) => void;
  onRemove: () => void;
  /** Swap it for another ingredient, keeping the amount (behind a tap on the name). */
  onSwap: () => void;
  /** A new house prep made here: open its recipe again. */
  onEditPrep?: () => void;
  /** A bottle already in the drink: say what you did to it (a fat wash, an infusion). */
  onMakeHouse?: () => void;
  /** The units to pick from; the finish offers drops, sprays, rinses and the garnish counts. */
  units?: readonly string[];
  /** Under the name on the desktop page: who brings it and what this pour costs ("Bluestone Trade · $1.28"). */
  detail?: string | null;
  /** Its grip, from DragRow: hold it and drag to move the line. */
  grip?: (node: ReactNode) => ReactNode;
  /** Moves the line one place up or down: the arrow keys on the web, a screen reader's actions. */
  onMove?: (by: -1 | 1) => void;
  /** Being dragged: lifted over the lines under it. */
  lifted?: boolean;
  /** Another line is held over this one: let go to batch them (lib/batchLines). */
  dropTarget?: boolean;
  /** Just before remove: the bottle that puts it on the back bar or your shelf (StockToggle). */
  stock?: ReactNode;
}

/**
 * One spec line, kept short: the ingredient, its amount (type it, or − and +
 * through the pours bartenders use), its unit (tap to change) and remove.
 * Tapping the name opens the rest: swap, a note, make it house, the recipe.
 * On a phone the controls sit under the name, and the bottle and remove
 * beside it; on a wider screen they all share its line, on the right.
 */
export function LineRow({ line, onChange, onRemove, onSwap, onEditPrep, onMakeHouse, units: unitList = QUICK_UNITS, detail, grip, onMove, lifted, dropTarget, stock }: LineRowProps) {
  const ds = useDs();
  // A phone stacks the name over the controls. Explicit, not flexWrap: Yoga on iOS shrank the name to "Rye wh…" beside them instead of wrapping (Eddie, 16 Oct).
  const stacked = useBreakpoint() === 'phone';
  const [units, setUnits] = useState(false);
  const [noting, setNoting] = useState(!!line.note);
  const [open, setOpen] = useState(false);
  const from = line.prep?.madeFrom ?? null;
  const top = line.unit === 'top';
  const amountLabel = top ? 'Top' : line.amount ? `${line.amount} ${line.unit}` : `no amount, ${line.unit}`;
  // What the line is, when it isn't a bottle that already exists: shown with its actions, not under every row.
  const status = line.id
    ? null
    : line.prep
      ? { text: ['House-made', from ? `from ${from.name}` : null, leadText(line.prep.leadMinutes) ?? 'your recipe'].filter(Boolean).join(', '), accent: false }
      : line.later
        ? { text: 'House prep, recipe to write', accent: true }
        : line.technique
          ? { text: `House prep: ${techniqueById(line.technique)?.name ?? 'made in house'}`, accent: true }
          : { text: 'New, added when you save', accent: false };
  // The bottle, then remove: beside the name on a phone, so the controls under it keep their width.
  const ends = (
    <>
      {stock}
      <PressableScale onPress={onRemove} role="button" accessibilityLabel={`Remove ${line.name}`} style={styles.remove}>
        <IconSymbol name="xmark" size={16} color={ds.c.muted} />
      </PressableScale>
    </>
  );
  return (
    <View role="listitem" style={[styles.wrap, { borderBottomColor: ds.c.line, backgroundColor: lifted ? ds.c.raised : undefined }, dropTarget ? [styles.target, { borderColor: ds.accentText, backgroundColor: withAlpha(ds.accentText, 0.1) }] : null]}>
      <View style={styles.row}>
        {grip?.(<LineGrip name={line.name} onMove={onMove} />)}
        <IngredientThumb id={line.id} name={line.name} size={40} />
        <View style={stacked ? styles.mainStacked : styles.main}>
          <View style={stacked ? styles.headStacked : styles.head}>
            {/* The name opens what else the line can do; closed, the row is the ingredient and its pour (board make-create-ingredients). */}
            <PressableScale
              onPress={() => setOpen(!open)}
              haptic={false}
              role="button"
              aria-expanded={open}
              accessibilityLabel={`${line.name}, ${amountLabel}`}
              accessibilityHint="Shows swap, note and more"
              style={stacked ? styles.nameStacked : styles.name}
            >
              <Body numberOfLines={2}>{line.name}</Body>
              {dropTarget ? <Caption tone="accent">Drop to batch</Caption> : null}
              {line.unit === 'discard' ? <Caption tone="accent">Expressed, then discarded</Caption> : null}
              {detail ? <Caption tone="muted" numberOfLines={1}>{detail}</Caption> : null}
            </PressableScale>
            {stacked ? ends : null}
          </View>
          <View style={styles.controls}>
            <View style={[styles.stepper, { backgroundColor: ds.c.raised }]}>
              {top ? (
                <DsText variant="spec" style={[styles.mono, styles.topLabel]}>Top</DsText>
              ) : (
                <>
                  <Round icon="minus" label={`Less ${line.name}`} onPress={() => onChange({ amount: stepAmount(tidyAmount(line.amount), line.unit, -1) })} />
                  <TextInput
                    value={line.amount}
                    onChangeText={(amount) => onChange({ amount: amount.replace(/[^0-9.,/ ¼½¾⅓⅔⅛]/g, '') })}
                    onBlur={() => onChange({ amount: tidyAmount(line.amount) })}
                    // iOS's keyboard has "/" for 3/4; Android has no such type, so its number pad.
                    keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'decimal-pad'}
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
              <DsText variant="spec" style={styles.mono}>{line.unit}</DsText>
              <IconSymbol name={units ? 'chevron.up' : 'chevron.down'} size={12} color={ds.c.muted} />
            </PressableScale>
          </View>
        </View>
        {stacked ? null : ends}
      </View>
      {open ? (
        <View style={[styles.more, grip ? styles.gripped : null]}>
          {status ? <Caption tone={status.accent ? 'accent' : 'muted'}>{status.text}</Caption> : null}
          {/* The recipe links lead in the accent; the rest stay quiet (the accent is for the one primary action). */}
          <View style={styles.links}>
            {line.prep && onEditPrep ? <TextAction label="Edit the recipe" a11y={`Edit the recipe for ${line.name}`} onPress={onEditPrep} accent /> : null}
            {line.later && !line.prep && onEditPrep ? <TextAction label="Write the recipe" a11y={`Write the recipe for ${line.name}`} onPress={onEditPrep} accent /> : null}
            <TextAction label="Swap" a11y={`Swap ${line.name} for another ingredient`} onPress={onSwap} />
            {from ? <TextAction label={`Back to ${from.name}`} a11y={`Back to plain ${from.name}`} onPress={() => onChange({ id: from.id, name: from.name, prep: undefined, technique: undefined })} /> : null}
            {noting ? null : <TextAction label="Note" a11y={`Add a note to ${line.name}`} onPress={() => { setNoting(true); setOpen(false); }} />}
            {!line.prep && !line.technique && line.id && onMakeHouse ? <TextAction label="Make it house" a11y={`Make ${line.name} house: wash, infuse, clarify`} onPress={onMakeHouse} /> : null}
          </View>
        </View>
      ) : null}
      {noting ? (
        <TextInput
          value={line.note ?? ''}
          onChangeText={(note) => onChange({ note })}
          placeholder="A note on the spec: which bottle, how it's cut"
          placeholderTextColor={ds.c.muted}
          aria-label={`Note on ${line.name}`}
          autoFocus={!line.note}
          maxLength={120}
          style={[styles.note, grip ? styles.notedGripped : null, type.body, { fontFamily: fontFamilies.body, color: ds.c.ink, borderColor: ds.c.lineStrong }]}
        />
      ) : null}
      {units ? (
        <View role="radiogroup" accessibilityLabel={`Unit for ${line.name}`} style={[styles.units, grip ? styles.gripped : null]}>
          {unitList.map((u) => (
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

/** A small text button under the line: Edit the recipe (accent); Swap, Note and Make it house (quiet). */
function TextAction({ label, a11y, onPress, accent }: { label: string; a11y: string; onPress: () => void; accent?: boolean }) {
  return (
    <PressableScale onPress={onPress} role="button" accessibilityLabel={a11y} style={styles.link}>
      <Caption tone={accent ? 'accent' : 'muted'}>{label}</Caption>
    </PressableScale>
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
  more: { paddingLeft: 40 + space.md, gap: space.xs },
  // Under the name when the line has a grip: past the grip, then the thumb.
  gripped: { paddingLeft: space.xl + space.sm + 40 + space.md },
  notedGripped: { marginLeft: space.xl + space.sm + 40 + space.md },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg },
  link: { minHeight: layout.minTapTarget, justifyContent: 'center' },
  note: { minHeight: layout.minTapTarget, marginLeft: 40 + space.md, borderWidth: 1, borderRadius: radius.control, paddingHorizontal: space.md },
  wrap: { paddingVertical: space.md, gap: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  // Lit up to drop on, as drawn: a dashed accent edge a little wider than the row.
  target: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: radius.control, marginHorizontal: -space.sm, paddingHorizontal: space.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  // The name and the controls: two lines on a phone, one on a wider screen.
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  mainStacked: { flex: 1, gap: space.xs },
  head: { flex: 1 },
  headStacked: { flexDirection: 'row', alignItems: 'flex-start' },
  name: { minHeight: layout.minTapTarget, justifyContent: 'center' },
  nameStacked: { flex: 1, minHeight: layout.minTapTarget, justifyContent: 'center' },
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
  // Five units to a phone row, as drawn.
  units: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2, paddingLeft: 40 + space.md },
});
