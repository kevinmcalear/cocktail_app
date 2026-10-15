import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Body, Caption, DsText, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { convertPour, QUICK_UNITS, stepAmount, type WizardLine } from '@/lib/drinkWizard';
import { leadText } from '@/lib/prepKinds';
import { tidyAmount } from '@/lib/specDefaults';
import { techniqueById } from '@/lib/techniques';

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
}

/**
 * One spec line, kept short: the ingredient, its amount (type it, or − and +
 * through the pours bartenders use), its unit (tap to change) and remove.
 * Tapping the name opens the rest: swap, a note, make it house, the recipe.
 * On a phone the controls sit under the name; on a wider screen they share
 * its line, on the right.
 */
export function LineRow({ line, onChange, onRemove, onSwap, onEditPrep, onMakeHouse, units: unitList = QUICK_UNITS, detail }: LineRowProps) {
  const ds = useDs();
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
  return (
    <View role="listitem" style={[styles.wrap, { borderBottomColor: ds.c.line }]}>
      <View style={styles.row}>
        <IngredientThumb id={line.id} name={line.name} size={40} />
        <View style={styles.main}>
          <View style={styles.head}>
            {/* The name opens what else the line can do; closed, the row is the ingredient and its pour (board make-create-ingredients). */}
            <PressableScale
              onPress={() => setOpen(!open)}
              haptic={false}
              role="button"
              aria-expanded={open}
              accessibilityLabel={`${line.name}, ${amountLabel}`}
              accessibilityHint="Shows swap, note and more"
              style={styles.name}
            >
              <Body numberOfLines={2}>{line.name}</Body>
              {detail ? (
                <Caption tone="muted" numberOfLines={1}>
                  {detail}
                </Caption>
              ) : null}
            </PressableScale>
          </View>
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
      {open ? (
        <View style={styles.more}>
          {status ? <Caption tone={status.accent ? 'accent' : 'muted'}>{status.text}</Caption> : null}
          {/* The recipe links lead in the accent; the rest stay quiet (the accent is for the one primary action). */}
          <View style={styles.links}>
            {line.prep && onEditPrep ? <TextAction label="Edit the recipe" a11y={`Edit the recipe for ${line.name}`} onPress={onEditPrep} accent /> : null}
            {line.later && !line.prep && onEditPrep ? <TextAction label="Write the recipe" a11y={`Write the recipe for ${line.name}`} onPress={onEditPrep} accent /> : null}
            <TextAction label="Swap" a11y={`Swap ${line.name} for another ingredient`} onPress={onSwap} />
            {from ? (
              <TextAction label={`Back to ${from.name}`} a11y={`Back to plain ${from.name}`} onPress={() => onChange({ id: from.id, name: from.name, prep: undefined, technique: undefined })} />
            ) : null}
            {noting ? null : (
              <TextAction
                label="Note"
                a11y={`Add a note to ${line.name}`}
                onPress={() => {
                  setNoting(true);
                  setOpen(false);
                }}
              />
            )}
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
          style={[styles.note, type.body, { fontFamily: fontFamilies.body, color: ds.c.ink, borderColor: ds.c.lineStrong }]}
        />
      ) : null}
      {units ? (
        <View role="radiogroup" accessibilityLabel={`Unit for ${line.name}`} style={styles.units}>
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
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg },
  link: { minHeight: layout.minTapTarget, justifyContent: 'center' },
  note: { minHeight: layout.minTapTarget, marginLeft: 40 + space.md, borderWidth: 1, borderRadius: radius.control, paddingHorizontal: space.md },
  wrap: { paddingVertical: space.md, gap: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  // The name (with its links) and the controls wrap: two lines on a phone, one on a wide screen.
  main: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.md, rowGap: space.xs },
  head: { flexGrow: 1, flexShrink: 1, flexBasis: 150 },
  name: { minHeight: layout.minTapTarget, justifyContent: 'center' },
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
