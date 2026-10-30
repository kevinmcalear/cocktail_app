import { useState, type ReactNode } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { Body, Caption, DsText, IngredientThumb, PressableScale, useBreakpoint, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { backbar, fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { withAlpha } from '@/lib/color';
import { convertPour, FINISH_UNITS, QUICK_UNITS, stepAmount, type WizardLine } from '@/lib/drinkWizard';
import { prepSummary, toFinishSummary } from '@/lib/prepKinds';
import { tidyAmount } from '@/lib/specDefaults';
import { techniqueById } from '@/lib/techniques';

import { CombineTag } from './CombineTag';
import { LineGrip } from './DragRow';
import { WizardChip } from './WizardChrome';

/** A spec line's units: the pours, then the finishes (a sprig, grated), so the editor's spec can garnish too (Eddie tf-062). */
const LINE_UNITS = [...QUICK_UNITS, ...FINISH_UNITS.filter((u) => !(QUICK_UNITS as readonly string[]).includes(u))];

/** Below this a row with the bottle stacks: grip, thumb, amount, unit, bottle and remove leave the name too little. */
const NARROW = 580;

interface LineRowProps {
  line: WizardLine;
  onChange: (change: Partial<WizardLine>) => void;
  onRemove: () => void;
  /** Swap it for another ingredient, keeping the amount (behind a tap on the name). */
  onSwap: () => void;
  /** A new house prep made here: open its recipe again (a tap on the line, for a prep). */
  onEditPrep?: () => void;
  /** The units to pick from; the finish offers drops, sprays, rinses and the garnish counts. */
  units?: readonly string[];
  /** Under the name on the desktop page: what this pour costs ("$1.28"), or a new bottle's chip. */
  detail?: ReactNode;
  /** Under the whole line: what opens in place on the desktop page (the supplier pick). */
  below?: ReactNode;
  /** Its grip, from DragRow: hold it and drag to move the line. */
  grip?: (node: ReactNode) => ReactNode;
  /** Moves the line one place up or down: the arrow keys on the web, a screen reader's actions. */
  onMove?: (by: -1 | 1) => void;
  /** Being dragged: lifted over the lines under it, folded to its name so they show. */
  lifted?: boolean;
  /** Another line is held over this one (its name): let go to combine them into a house prep (lib/batchLines). */
  dropTarget?: string | null;
  /** Lifted and held over a line it can combine with (that line's name): a tag above the card says so, clear of the thumb. */
  combineWith?: string | null;
  /** Made in parts, lifted over another part: the tag says "Move to The cream" instead. */
  moveTo?: string | null;
  /** Just before remove: the bottle that puts it on the back bar or your shelf (StockToggle); null for a line without one. */
  stock?: ReactNode;
}

/**
 * One spec line, kept short: the ingredient, its amount (type it, or − and +
 * through the pours bartenders use), its unit (tap to change) and remove.
 * Tapping the name opens the rest: swap, a note, the recipe to write. A
 * house prep says so under its name (Made in-house, its kind and way, what
 * goes in, its steps), and a tap opens its recipe (make-anything-steps-2,
 * step 7). Held over by another line, it offers to combine them.
 * On a phone the controls sit under the name, and the bottle and remove
 * beside it; on a wider screen they all share its line, on the right.
 */
export function LineRow({ line, onChange, onRemove, onSwap, onEditPrep, units: unitList = LINE_UNITS, detail, below, grip, onMove, lifted, dropTarget, combineWith, moveTo, stock }: LineRowProps) {
  const ds = useDs();
  // A phone stacks the name over the controls. Explicit, not flexWrap: Yoga on iOS shrank the name to "Rye wh…" beside them instead of wrapping (Eddie, 16 Oct).
  // So does a narrow column (the desktop page's spec, an ingredient's recipe beside its method), where the controls left the name a few letters.
  const [narrow, setNarrow] = useState(false);
  const stacked = useBreakpoint() === 'phone' || narrow;
  const [units, setUnits] = useState(false);
  const [noting, setNoting] = useState(!!line.note);
  const [open, setOpen] = useState(false);
  const from = line.prep?.madeFrom ?? null;
  // A house prep opens its recipe; anything else, what else it can do.
  const recipe = line.prep && onEditPrep ? onEditPrep : null;
  const top = line.unit === 'top';
  const amountLabel = top ? 'Top' : line.amount ? `${line.amount} ${line.unit}` : `no amount, ${line.unit}`;
  // What the line is, when it isn't a bottle that already exists: shown with its actions, not under every row.
  const status = line.id
    ? null
    : line.later
        ? { text: 'House-made, recipe to write', accent: true }
        : line.technique
          ? { text: `House-made: ${techniqueById(line.technique)?.name ?? 'your recipe'}`, accent: true }
          : { text: line.bottle ? 'A bottle you buy, added when you save' : 'New, added when you save', accent: false };
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
    <View
      role="listitem"
      onLayout={(e) => !lifted && setNarrow(e.nativeEvent.layout.width < NARROW)}
      style={[styles.wrap, { borderBottomColor: ds.c.line }, lifted ? [styles.lifted, { backgroundColor: ds.c.raised, borderColor: combineWith ? ds.accentText : ds.c.lineStrong }] : null, dropTarget ? [styles.target, { borderColor: ds.accentText, backgroundColor: withAlpha(ds.accentText, 0.1) }] : null]}
    >
      {lifted && combineWith ? <CombineTag pair={`${line.name} + ${combineWith}`} /> : lifted && moveTo ? <CombineTag title={`Move to ${moveTo}`} /> : null}
      <View style={styles.row}>
        {grip?.(<LineGrip name={line.name} onMove={onMove} />)}
        <IngredientThumb id={line.id} name={line.name} size={lifted ? 32 : 40} />
        {/* Lifted, the line folds to its name and pour, so the lines under it show (Kevin, 27 Oct); what letting go does is the tag above it. The grip keeps its place in the tree, so the drag holding it carries on. */}
        {lifted ? (
          <View style={styles.flex}>
            <Body numberOfLines={1}>{line.name}</Body>
            <Caption tone="muted" numberOfLines={1}>
              {amountLabel}
            </Caption>
          </View>
        ) : (
          <View style={stacked ? styles.mainStacked : styles.main}>
            <View style={stacked ? styles.headStacked : styles.head}>
              {/* The name opens what else the line can do; closed, the row is the ingredient and its pour (board make-create-ingredients). */}
              <PressableScale
                onPress={recipe ?? (() => setOpen(!open))}
                haptic={false}
                role="button"
                aria-expanded={recipe ? undefined : open}
                accessibilityLabel={`${line.name}, ${amountLabel}${line.prep ? (line.prep.at ? `. Recipe to finish: ${toFinishSummary(line.prep)}` : `. House-made: ${prepSummary(line.prep, techniqueById(line.prep.technique)?.name)}`) : ''}`}
                accessibilityHint={recipe ? 'Opens its recipe' : 'Shows swap, note and more'}
                style={[stacked ? styles.nameStacked : styles.name, line.prep ? styles.prepName : null]}
              >
                <View style={styles.flex}>
                  <Body numberOfLines={2}>{line.name}</Body>
                  {dropTarget ? (
                    <Caption tone="accent">Let go to combine</Caption>
                  ) : line.prep ? (
                    <>
                      {/* Left for later (make-anything-steps-3, step 9): a tap picks up where it was left. */}
                      <Caption tone="accent">{line.prep.at ? 'Recipe to finish' : 'House-made'}</Caption>
                      <Caption tone="muted" numberOfLines={2}>
                        {line.prep.at ? toFinishSummary(line.prep) : prepSummary(line.prep, techniqueById(line.prep.technique)?.name)}
                      </Caption>
                    </>
                  ) : null}
                  {line.unit === 'discard' ? <Caption tone="accent">Expressed, then discarded</Caption> : null}
                  {line.float || line.optional ? <Caption tone="muted">{[line.float && 'Float', line.optional && 'Optional'].filter(Boolean).join(' · ')}</Caption> : null}
                </View>
                {recipe ? <IconSymbol name="chevron.right" size={14} color={ds.c.muted} /> : null}
              </PressableScale>
              {/* Beside the name's button, not in it: the detail can be a button of its own (the supplier chip). */}
              {stacked ? ends : detail}
            </View>
            {stacked ? detail : null}
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
        )}
        {stacked || lifted ? null : ends}
      </View>
      {lifted ? null : below}
      {open && !lifted ? (
        <View style={[styles.more, grip ? styles.gripped : null]}>
          {status ? <Caption tone={status.accent ? 'accent' : 'muted'}>{status.text}</Caption> : null}
          {/* The recipe links lead in the accent; the rest stay quiet (the accent is for the one primary action). */}
          <View style={styles.links}>
            {line.later && !line.prep && onEditPrep ? <TextAction label="Write the recipe" a11y={`Write the recipe for ${line.name}`} onPress={onEditPrep} accent /> : null}
            <TextAction label="Swap" a11y={`Swap ${line.name} for another ingredient`} onPress={onSwap} />
            {from ? <TextAction label={`Back to ${from.name}`} a11y={`Back to plain ${from.name}`} onPress={() => onChange({ id: from.id, name: from.name, prep: undefined, technique: undefined })} /> : null}
            {noting ? null : <TextAction label="Note" a11y={`Add a note to ${line.name}`} onPress={() => { setNoting(true); setOpen(false); }} />}
            {line.unit !== 'float' ? <TextAction label={line.float ? 'Not a float' : 'Float'} a11y={line.float ? `${line.name} is mixed in` : `Float ${line.name} on top`} onPress={() => onChange({ float: !line.float })} /> : null}
            <TextAction label={line.optional ? 'Not optional' : 'Optional'} a11y={line.optional ? `${line.name} is needed` : `${line.name} is optional`} onPress={() => onChange({ optional: !line.optional })} />
          </View>
        </View>
      ) : null}
      {noting && !lifted ? (
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
      {units && !lifted ? (
        <View role="radiogroup" accessibilityLabel={`Unit for ${line.name}`} style={[styles.units, grip ? styles.gripped : null]}>
          {(unitList.includes(line.unit) || !line.unit ? unitList : [...unitList, line.unit]).map((u) => (
            <WizardChip
              key={u}
              label={u}
              selected={line.unit === u}
              onPress={() => {
                // ml, cl and oz convert ("22.5" ml is "0.75" oz); other units keep the number.
                const n = parseFloat(tidyAmount(line.amount));
                const pour = Number.isFinite(n) ? convertPour(n, line.unit, u) : null;
                onChange(u === 'top' || u === 'grated' ? { unit: u, amount: '' } : pour?.unit === u ? pour : { unit: u });
                setUnits(false);
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** A small text button under the line: Write the recipe (accent); Swap and Note (quiet). */
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
  prepName: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1, minWidth: 0 },
  // Being dragged: a card of its own, a little in from the edges, with a line round it (the accent when letting go combines).
  lifted: { borderWidth: 1.5, borderBottomWidth: 1.5, borderRadius: radius.control, marginHorizontal: space.sm, paddingVertical: space.sm, paddingHorizontal: space.sm, alignSelf: 'stretch', shadowColor: backbar.dark.ground, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.45, shadowRadius: 22, elevation: 8 },
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
