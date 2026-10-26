import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Caption, IngredientThumb, PressableScale, Spec, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Choice } from '@/components/screens/batch/BatchParts';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import type { IngredientAlias } from '@/lib/ingredientNames';
import { ALLERGENS, listAllergens, type Allergen } from '@/lib/allergens';
import { MEASURE_UNITS, partsText, prepAmounts, prepSummary, prepYield, slotMessage, toFinishSummary, type PrepDraft, type PrepDraftLine } from '@/lib/prepKinds';
import { formatQuantity, toQuantity } from '@/lib/quantity';
import { capitalizeFirst } from '@/lib/stringUtils';
import { prepUnit } from '@/lib/unitGuess';

import { IngredientSearch, type CatalogIngredient } from '../IngredientSearch';
import { WizardChip } from '../WizardChrome';
import { InDrink, type InDrinkPour } from './InDrink';
import { NumberField, Shares } from './RecipeBits';

interface PrepRecipeStepProps {
  draft: PrepDraft;
  /** Parts of the base, or the amounts they come to (RecipeView, beside the title). */
  view: RecipeViewKind;
  set: (change: Partial<PrepDraft>) => void;
  ingredients: readonly CatalogIngredient[];
  aliases?: readonly IngredientAlias[];
  /** The drink's pour of it, for "In Salty Boy 22.5 ml" and how many a bottle makes. */
  inDrink?: InDrinkPour;
  /** Make a line in-house too, one level down (make-anything-steps-2, step 8): its key, once it's in the recipe, and the lines as they were if it was just added or renamed. */
  onMake?: (key: string, before?: PrepDraftLine[]) => void;
  /** Under a line: its own recipe, open in place on the desktop page. */
  below?: (line: PrepDraftLine) => ReactNode;
}

const VIEWS = [
  { value: 'amounts', label: 'As measured' },
  { value: 'parts', label: 'Parts' },
] as const;
const UNITS = ['g', 'ml', 'tsp', 'drop', 'each', ''] as const;
export type RecipeViewKind = (typeof VIEWS)[number]['value'];

/** Parts or Amounts, right of the recipe step's title. */
export function RecipeView({ value, onChange }: { value: RecipeViewKind; onChange: (v: RecipeViewKind) => void }) {
  return <Choice label="Show as" options={VIEWS} value={value} onChange={onChange} />;
}

/**
 * New prep, what goes in: parts of one base line, which carries the amount
 * (step it up or down and the rest follows), or every line as it's measured
 * in, in any unit (make-anything-steps-2, step 5: 750 ml of liqueur, 70 g of
 * miso). Lines can be swapped, removed or added; a line with its own amount
 * (2 chilies) stays as typed. A stand-in from a technique ("Spirit") shows
 * as "Pick the spirit" and has to be picked or taken out before the prep
 * can be added.
 */
export function PrepRecipeStep({ draft, view, set, ingredients, aliases, inDrink, onMake, below }: PrepRecipeStepProps) {
  const ds = useDs();
  const [swapKey, setSwapKey] = useState<string | null>(null);
  const [noteKey, setNoteKey] = useState<string | null>(null);
  const [unitKey, setUnitKey] = useState<string | null>(null);
  const [allergensOpen, setAllergensOpen] = useState(false);
  const amounts = prepAmounts(draft);
  const base = draft.lines.find((l) => l.key === draft.baseKey);
  const makes = prepYield(draft);
  const waiting = slotMessage(draft);
  const allergens = draft.allergens ?? [];
  const toggleAllergen = (key: Allergen) => set({ allergens: allergens.includes(key) ? allergens.filter((k) => k !== key) : [...allergens, key], allergensSet: true });
  const contains = [listAllergens(allergens), ...(draft.contains ?? []).map((c) => c.toLowerCase())].filter(Boolean).join(', ');
  const change = (key: string, c: Partial<PrepDraftLine>) => set({ lines: draft.lines.map((l) => (l.key === key ? { ...l, ...c } : l)) });
  const remove = (l: PrepDraftLine) => {
    const lines = draft.lines.filter((x) => x.key !== l.key);
    // Taking out the base hands it to the next line with parts.
    const nextBase = l.key === draft.baseKey ? lines.find((x) => x.parts !== null) : null;
    set({ lines, ...(nextBase ? { baseKey: nextBase.key, baseAmount: Math.round(((amounts.find((a) => a.line.key === nextBase.key)?.amount ?? 100) * 10)) / 10 } : null) });
  };
  // A new line made in-house: in the recipe first, then its own steps one level down.
  const makeNew = onMake
    ? (name: string) => {
        const key = `n${Date.now().toString(36)}`;
        set({ lines: [...draft.lines, { key, id: null, name: capitalizeFirst(name), parts: null, unit: prepUnit(name), amount: '' }] });
        onMake(key, draft.lines);
      }
    : undefined;
  const step = draft.baseAmount >= 100 ? 50 : 10;
  const search = { ingredients, aliases };
  // As measured: the base's amount is the batch's; another part follows from it; a line of its own keeps what's typed. An emptied part waits for a number.
  const perPart = base?.parts ? draft.baseAmount / base.parts : null;
  const measure = (l: PrepDraftLine, v: number) => {
    if (l.parts === null) return change(l.key, { amount: v > 0 ? String(v) : '' });
    if (v <= 0) return;
    if (l.key === draft.baseKey) set({ baseAmount: v });
    else if (perPart) change(l.key, { parts: Math.round((v / perPart) * 10000) / 10000 });
  };
  // A pour counts towards what it makes; weighed or counted, it doesn't.
  const unit = (l: PrepDraftLine, u: string) => change(l.key, { unit: u, ...(u === 'ml' ? { yieldPer: 1 } : l.unit === 'ml' ? { yieldPer: 0 } : null) });

  return (
    <View style={styles.stack}>
      <Shares draft={draft} />
      {/* A bottle keeps its label's capitals (Bacardí Carta Blanca); a plain base reads in lower case (the white rum). */}
      <Caption tone="muted">{base ? `Everything follows the ${base.name === draft.madeFrom?.name ? base.name : base.name.toLowerCase()}.` : 'Add what goes in.'}</Caption>
      <View role="list">
        {draft.lines.map((l, i) => {
          const isBase = l.key === draft.baseKey;
          const amount = amounts[i].amount;
          const shown = amount !== null ? formatQuantity(toQuantity(amount, l.unit) ?? { kind: 'count', value: amount, unit: l.unit || 'each' }) : '';
          const units =
            unitKey === l.key ? (
              <View role="radiogroup" aria-label={`Unit for ${l.name}`} style={styles.units}>
                {MEASURE_UNITS.map((u) => (
                  <WizardChip
                    key={u}
                    label={u}
                    selected={l.unit === u}
                    onPress={() => {
                      unit(l, u);
                      setUnitKey(null);
                    }}
                  />
                ))}
              </View>
            ) : null;
          return l.key === swapKey ? (
            <View key={l.key} style={[styles.swap, { borderBottomColor: ds.c.line }]}>
              <IngredientSearch
                {...search}
                label={l.slot ? `Pick the ${l.slot}` : `Swap ${l.name} for…`}
                autoFocus
                onCancel={() => setSwapKey(null)}
                onPick={(p) => {
                  change(l.key, { id: p.id, name: p.name, slot: undefined, prep: undefined });
                  setSwapKey(null);
                }}
                onMake={
                  onMake
                    ? (name) => {
                        change(l.key, { id: null, name: capitalizeFirst(name), slot: undefined });
                        setSwapKey(null);
                        onMake(l.key, draft.lines);
                      }
                    : undefined
                }
              />
            </View>
          ) : (
            <View key={l.key} role="listitem" style={[styles.item, { borderBottomColor: ds.c.line }]}>
              <View style={styles.line}>
                <IngredientThumb id={l.id} name={l.name} size={36} />
                <View style={styles.name}>
                  <PressableScale
                    accessibilityLabel={l.slot ? `Pick the ${l.slot}` : l.prep && onMake ? `${l.name}, ${l.prep.at ? 'a recipe to finish. Pick it up' : 'house-made. Open its recipe'}` : `${l.name}. Swap it`}
                    onPress={() => (l.prep && onMake ? onMake(l.key) : setSwapKey(l.key))}
                    style={styles.swapName}
                  >
                    <Body numberOfLines={3} tone={l.slot ? 'accent' : undefined}>{l.slot ? `Pick the ${l.slot}` : l.name}</Body>
                    {l.prep ? <Caption tone="accent">{l.prep.at ? `Recipe to finish · ${toFinishSummary(l.prep)}` : `House-made · ${prepSummary(l.prep)}`}</Caption> : null}
                    {isBase ? <Caption tone="accent">{view === 'amounts' ? 'The base' : 'The base, everything follows it'}</Caption> : l.removed ? <Caption tone="muted">Taken out before bottling</Caption> : view === 'amounts' && l.parts !== null && base?.parts ? <Caption tone="muted">{partsText(l.parts, base.parts)}</Caption> : null}
                  </PressableScale>
                  {l.slot ? null : noteKey === l.key ? (
                    <TextInput
                      value={l.note ?? ''}
                      onChangeText={(note) => change(l.key, { note })}
                      onBlur={() => setNoteKey(null)}
                      onSubmitEditing={() => setNoteKey(null)}
                      autoFocus
                      returnKeyType="done"
                      placeholder="How it goes in: sliced, seeds in"
                      placeholderTextColor={ds.c.muted}
                      aria-label={`Note on ${l.name}`}
                      maxLength={120}
                      style={[styles.note, type.caption, { fontFamily: fontFamilies.body, color: ds.c.ink, borderColor: ds.c.lineStrong }]}
                    />
                  ) : (
                    <PressableScale role="button" accessibilityLabel={l.note ? `Note on ${l.name}: ${l.note}. Change it` : `Add a note to ${l.name}`} onPress={() => setNoteKey(l.key)} style={styles.noteButton}>
                      <Caption tone="muted" numberOfLines={2}>{l.note?.trim() || 'Note'}</Caption>
                    </PressableScale>
                  )}
                </View>
                {view === 'amounts' && !l.slot ? (
                  <View style={styles.own}>
                    <NumberField label={`${l.name}, as measured, ${l.unit || 'no unit'}`} value={amount === null ? '' : String(amount)} onChange={(v) => measure(l, v)} placeholder="to taste" />
                    <PressableScale role="button" aria-expanded={unitKey === l.key} accessibilityLabel={`Unit for ${l.name}: ${l.unit || 'none'}`} onPress={() => setUnitKey(unitKey === l.key ? null : l.key)} style={[styles.pill, { borderColor: unitKey === l.key ? ds.c.ink : ds.c.lineStrong }]}>
                      <Caption>{l.unit || 'unit'}</Caption>
                      <IconSymbol name={unitKey === l.key ? 'chevron.up' : 'chevron.down'} size={12} color={ds.c.muted} />
                    </PressableScale>
                  </View>
                ) : isBase && l.parts !== null ? (
                  <View style={[styles.box, { backgroundColor: ds.c.raised }]}>
                    <PressableScale accessibilityLabel={`Less ${l.name}`} onPress={() => set({ baseAmount: Math.max(step, draft.baseAmount - step) })} style={styles.tap}>
                      <IconSymbol name="minus" size={16} color={ds.c.ink} />
                    </PressableScale>
                    <Spec>{shown}</Spec>
                    <PressableScale accessibilityLabel={`More ${l.name}`} onPress={() => set({ baseAmount: draft.baseAmount + step })} style={styles.tap}>
                      <IconSymbol name="plus" size={16} color={ds.c.ink} />
                    </PressableScale>
                  </View>
                ) : l.parts !== null && view === 'parts' ? (
                  <NumberField label={`Parts of ${l.name}`} value={String(l.parts)} onChange={(v) => v > 0 && change(l.key, { parts: v })} suffix="parts" />
                ) : l.parts !== null ? (
                  <Spec tone="muted">{shown}</Spec>
                ) : (
                  <View style={styles.own}>
                    <NumberField label={`How much ${l.name}`} value={l.amount} onChange={(v) => change(l.key, { amount: v > 0 ? String(v) : '' })} placeholder="to taste" />
                    <PressableScale accessibilityLabel={`Unit: ${l.unit || 'none'}. Change`} onPress={() => change(l.key, { unit: UNITS[(UNITS.indexOf(l.unit as (typeof UNITS)[number]) + 1) % UNITS.length] })} style={styles.unit}>
                      <Caption>{l.unit || 'unit'}</Caption>
                    </PressableScale>
                  </View>
                )}
                <PressableScale accessibilityLabel={`Remove ${l.name}`} onPress={() => remove(l)} style={styles.tap}>
                  <IconSymbol name="xmark" size={14} color={ds.c.muted} />
                </PressableScale>
              </View>
              {units}
              {below?.(l)}
            </View>
          );
        })}
      </View>
      {waiting ? <Caption tone="accent">{waiting}</Caption> : null}
      <IngredientSearch {...search} label="Add an ingredient" onPick={(p) => set({ lines: [...draft.lines, { key: `n${Date.now().toString(36)}`, id: p.id, name: p.name, parts: null, unit: prepUnit(p.name), amount: '' }] })} onMake={makeNew} />
      {onMake ? <Caption tone="muted">Any line here can be made in-house too: it steps in one more level.</Caption> : null}
      <View style={styles.facts}>
        <View style={[styles.fact, { backgroundColor: ds.c.raised }]}>
          <Caption tone="muted">Makes about</Caption>
          <Body>{makes ? formatQuantity({ kind: 'ml', value: makes, unit: 'ml' }) : 'Set by your first batch'}</Body>
        </View>
        {inDrink ? <InDrink pour={inDrink} draft={draft} makes={makes} /> : null}
      </View>
      {inDrink ? <InDrink pour={inDrink} draft={draft} makes={makes} caption /> : null}
      <View style={styles.facts}>
        <PressableScale
          role="button"
          aria-expanded={allergensOpen}
          accessibilityLabel={`Allergens: ${contains || 'none'}. ${draft.allergensSet ? 'Change them' : 'Set them'}`}
          onPress={() => setAllergensOpen(!allergensOpen)}
          style={[styles.fact, { backgroundColor: ds.c.raised }]}
        >
          <Caption tone="muted">Allergens</Caption>
          <Body>{`${contains ? contains[0].toUpperCase() + contains.slice(1) : 'None'} · ${draft.allergensSet ? 'tap to change' : 'tap to set'}`}</Body>
        </PressableScale>
      </View>
      {allergensOpen ? (
        <View role="group" accessibilityLabel="Allergens in it" style={styles.toggles}>
          {ALLERGENS.map((a) => {
            const on = allergens.includes(a.key);
            return (
              <PressableScale
                key={a.key}
                role="checkbox"
                aria-checked={on}
                accessibilityLabel={a.label}
                onPress={() => toggleAllergen(a.key)}
                style={[styles.toggle, { backgroundColor: on ? ds.c.ink : ds.c.raised, borderColor: on ? ds.c.ink : ds.c.line }]}
              >
                <Caption color={on ? ds.c.ground : ds.c.ink}>{a.label}</Caption>
              </PressableScale>
            );
          })}
        </View>
      ) : null}
      <Caption tone="muted">“Makes about” is a guess from the weights. Log your first batch and it uses the real number.</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  item: { borderBottomWidth: StyleSheet.hairlineWidth },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.minTapTarget + space.lg },
  units: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2, paddingLeft: 36 + space.sm, paddingBottom: space.sm },
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, minWidth: 52, minHeight: layout.minTapTarget, paddingHorizontal: space.sm, borderRadius: radius.pill, borderWidth: 1 },
  swap: { paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { flex: 1, justifyContent: 'center', paddingVertical: space.xs },
  swapName: { minHeight: layout.minTapTarget, justifyContent: 'center' },
  noteButton: { minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' },
  note: { minHeight: layout.minTapTarget, borderWidth: 1, borderRadius: radius.control, paddingHorizontal: space.sm },
  toggles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  toggle: { minHeight: layout.minTapTarget, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1 },
  box: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, minHeight: 40, paddingHorizontal: space.xs },
  tap: { minWidth: layout.minTapTarget, minHeight: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  own: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  unit: { minWidth: layout.minTapTarget, minHeight: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  facts: { flexDirection: 'row', gap: space.sm },
  fact: { flex: 1, borderRadius: radius.control, padding: space.md, gap: 2 },
});
