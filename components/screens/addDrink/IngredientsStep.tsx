import { useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, useDs } from '@/components/ds';
import type { TellUsAbout } from '@/components/feedback/TellUs';
import { radius, space } from '@/constants/tokens';
import { useExpiring } from '@/hooks/useExpiring';
import { perDrinkLines } from '@/lib/batchLines';
import { guessUnit, newLine, pickByName, typedUnit, type StepProps, type WizardLine, type WizardPick } from '@/lib/drinkWizard';
import { dropIndex } from '@/lib/dropIndex';
import { houseNudge, houseWays } from '@/lib/makeItHouse';
import type { IngredientAlias } from '@/lib/ingredientNames';
import type { TypedPour } from '@/lib/paste';
import { PREP_KINDS, type PrepDraft } from '@/lib/prepKinds';
import { suggestAmount, tidyAmount } from '@/lib/specDefaults';
import { capitalizeFirst } from '@/lib/stringUtils';
import { techniqueById, type Technique } from '@/lib/techniques';
import { startsFrom } from '@/lib/techniques/makeIt';
import { nameFor } from '@/lib/techniques/template';
import { getPreferredUnit } from '@/store/useSettingsStore';

import { BatchLineRow } from './BatchLineRow';
import { DragRow } from './DragRow';
import { BalanceCard } from './GoesWith';
import { IngredientSearch, type CatalogIngredient } from './IngredientSearch';
import { IngredientSuggestions } from './IngredientSuggestions';
import { LineRow } from './LineRow';
import { MakeItHouseSheet } from './MakeItHouseSheet';
import { PrepBuilder } from './prep/PrepBuilder';
import type { LineStock } from './StockToggle';
import { useBatchDrop } from './useBatchDrop';
import { WizardNotice } from './WizardChrome';

/** How long "Removed … Undo", and "Shrub added", stay. */
const UNDO_MS = 10000;

interface IngredientsStepProps extends StepProps {
  ingredients: readonly CatalogIngredient[];
  loading?: boolean;
  aliases?: readonly IngredientAlias[];
  coreIds?: ReadonlySet<string>;
  /** Off for a house recipe (a syrup, a batch): no cocktail pours, pairings, classics or balance. */
  forDrink?: boolean;
  /** At home: the bottles on your shelf, so search says "On your shelf". */
  shelf?: ReadonlySet<string>;
  /** At a venue: what's on its back bar, so its bottles lead "Pick a brand". */
  backBar?: ReadonlySet<string>;
  /** Off on the desktop page, where the taste sits beside the spec. */
  balance?: boolean;
  /** Under each line's name on the desktop page: its supplier and cost. */
  lineDetail?: (line: WizardLine) => ReactNode;
  /** Under each line on the desktop page: what opens in place (the supplier pick). */
  lineBelow?: (line: WizardLine) => ReactNode;
  /** Each bottle line's back bar (or shelf) toggle, and its hint and note (StockToggle). */
  stock?: LineStock;
  /** Make it house's "Tell us": the drink and bar a note would come from. */
  tellUs?: TellUsAbout;
  /** The add field's hint, when it says more than "Add an ingredient" (the desktop page's "30 pommeau" works too). */
  placeholder?: string;
}

/**
 * The spec so far, each line editable where it is; a field to find an
 * ingredient (or add a new one); and suggestions: the common ones, what
 * goes with what's in it, a classic to start from, and a one-tap fix when
 * it's out of balance. Each new line starts at a likely pour.
 */
export function IngredientsStep({ draft, set, ingredients, loading, aliases = [], coreIds, forDrink = true, shelf, backBar, balance = true, lineDetail, lineBelow, stock, tellUs, placeholder }: IngredientsStepProps) {
  const ds = useDs();
  const [typing, setTyping] = useState(false);
  const [swapKey, setSwapKey] = useState<string | null>(null);
  const [removed, setRemoved] = useExpiring<{ line: WizardLine; at: number }>(UNDO_MS);
  /**
   * A house prep being made: a new line, the recipe of a line in the drink
   * (its key), or a line swapped for one (its key, `replace`). Make it house
   * on a bottle also brings the technique and the bottle as its base.
   */
  const [making, setMaking] = useState<{ name: string; key?: string; replace?: boolean; technique?: string; base?: WizardPick; pour?: TypedPour } | null>(null);
  // Plain values: the React Compiler reads `making.key` eagerly for its memo deps, which throws while it's closed.
  const editingKey = making?.key ?? null;
  const makingName = making?.name ?? null;
  const replacing = !!making?.replace;
  const makingTechnique = making?.technique ?? null;
  const makingBase = making?.base ?? null;
  const makingPour = making?.pour;
  /** The bottle line "What did you do to it?" is open for. */
  const [houseKey, setHouseKey] = useState<string | null>(null);
  const [nudgeOff, setNudgeOff] = useState(false);
  /** A prep just made in the builder: "Shrub saved to your preps…" for a moment. */
  const [madePrep, setMadePrep] = useExpiring<string>(UNDO_MS);
  // Shown the way it saves ("coconut fat washed rum" is "Coconut fat washed rum").
  const make = (name: string, key?: string, pour?: TypedPour) => setMaking({ name: capitalizeFirst(name), key, replace: !!key, pour });
  const generic = (id: string | null) => {
    const row = id ? ingredients.find((i) => i.id === id) : null;
    return row?.generic_id ? ingredients.find((i) => i.id === row.generic_id)?.name ?? null : null;
  };
  // Bottles a technique can change (a spirit, a juice), and what the drink's name says about one.
  const changeable = (l: WizardLine) => !!l.id && !!(startsFrom(l.name) ?? startsFrom(generic(l.id) ?? ''));
  const nudge = forDrink && !nudgeOff ? houseNudge(draft.name, draft.lines.map((l) => ({ ...l, styleName: generic(l.id) }))) : null;
  const houseLine = houseKey ? draft.lines.find((l) => l.key === houseKey) ?? null : null;
  const makeHouse = (line: WizardLine, t: Technique, adjunct: string | null) => {
    setHouseKey(null);
    setMaking({ name: nameFor(t, { base: line.name, adjunct }), key: line.key, replace: true, technique: t.id, base: { id: line.id, name: line.name } });
  };

  // A pour typed with the name ("30 pommeau") is the line's; otherwise it starts at a likely one.
  const add = (pick: WizardPick, prep?: PrepDraft, later?: boolean, pour?: TypedPour) => {
    const unit = pour ? typedUnit(pick.name, pour.unit, getPreferredUnit()) : guessUnit(pick.name, getPreferredUnit());
    const amount = pour ? tidyAmount(pour.amount) : !forDrink ? '' : suggestAmount({ name: pick.name, genericName: generic(pick.id) }, unit, draft.lines.map((l) => ({ name: l.name, genericName: generic(l.id) })));
    set({ lines: [...draft.lines, { ...newLine(pick, unit, amount), ...(prep ? { prep, technique: prep.technique } : null), ...(later ? { later: true } : null) }] });
    setRemoved(null);
  };
  // What the prep is, for "Shrub added": its kind, its technique, else its name.
  const prepWord = (prep: PrepDraft, name: string) =>
    (prep.technique ? techniqueById(prep.technique)?.name : prep.kind !== 'other' ? PREP_KINDS.find((k) => k.id === prep.kind)?.name : null) ?? name;
  const change = (key: string, c: Partial<WizardLine>) => set({ lines: draft.lines.map((l) => (l.key === key ? { ...l, ...c } : l)) });
  const remove = (line: WizardLine) => {
    setRemoved({ line, at: draft.lines.indexOf(line) });
    set({ lines: draft.lines.filter((x) => x.key !== line.key) });
  };
  const undo = () => {
    if (!removed) return;
    const lines = [...draft.lines];
    lines.splice(Math.min(removed.at, lines.length), 0, removed.line);
    set({ lines });
    setRemoved(null);
  };
  // The order is the spec's: what saves and what the drawing pours. Each line's height says where a dragged one lands.
  const heights = useRef<Record<string, number>>({});
  const move = (from: number, to: number) => {
    if (to < 0 || to >= draft.lines.length || to === from) return;
    const lines = [...draft.lines];
    lines.splice(to, 0, ...lines.splice(from, 1));
    set({ lines });
  };
  const rowHeights = () => draft.lines.map((l) => heights.current[l.key] ?? 0);
  // Held over another line for the dwell, it batches with it (board fix 9); otherwise it lands where it's let go.
  const batches = useBatchDrop({ draft, set, enabled: forDrink, heights: rowHeights });
  const drop = (from: number, dy: number) => batches.onDrop(from) || move(from, dropIndex(from, dy, rowHeights()));
  // The taste and what goes with it read one drink's own lines, not the batch.
  const poured = perDrinkLines(draft.lines);
  const search = { ingredients, aliases, coreIds, loading, shelf, backBar, brands: true };

  return (
    <View style={styles.stack}>
      {draft.lines.length ? (
        <View role="list" aria-label="In the drink">
          {draft.lines.map((l, i) => (
            <DragRow key={l.key} index={i} onDrop={drop} onMove={forDrink ? batches.onMove : undefined} onHeight={(h) => (heights.current[l.key] = h)}>
              {(grip, lifted) =>
                // The lines keep their size while the next one is searched: folding them read as squeezed (Eddie, 16 Oct).
                l.key === swapKey ? (
                  <View style={[styles.swap, { borderBottomColor: ds.c.line }]}>
                    <IngredientSearch
                      {...search}
                      label={`Swap ${l.name} for…`}
                      autoFocus
                      onCancel={() => setSwapKey(null)}
                      onPick={(p) => {
                        // A different ingredient isn't the house prep that was here.
                        change(l.key, { id: p.id, name: p.name, prep: undefined, technique: undefined });
                        setSwapKey(null);
                      }}
                      onMake={
                        forDrink
                          ? (name) => {
                              make(name, l.key);
                              setSwapKey(null);
                            }
                          : undefined
                      }
                    />
                  </View>
                ) : l.batch ? (
                  <BatchLineRow line={l} grip={grip} lifted={lifted} dropTarget={batches.target === i} onMove={(by) => move(i, i + by)} onOpen={() => batches.open(l.key)} onRemove={() => remove(l)} />
                ) : (
                  <LineRow
                    line={l}
                    grip={grip}
                    lifted={lifted}
                    dropTarget={batches.target === i}
                    onMove={(by) => move(i, i + by)}
                    onChange={(c) => change(l.key, c)}
                    onRemove={() => remove(l)}
                    onSwap={() => setSwapKey(l.key)}
                    onEditPrep={() => setMaking({ name: l.name, key: l.key })}
                    onMakeHouse={forDrink && changeable(l) ? () => setHouseKey(l.key) : undefined}
                    detail={lineDetail?.(l)}
                    below={lineBelow?.(l)}
                    stock={stock?.toggle(l)}
                  />
                )
              }
            </DragRow>
          ))}
        </View>
      ) : null}
      {stock?.footer}
      {draft.lines.length > 1 ? <Caption tone="muted">{forDrink ? 'Hold a line over another to batch them. Hold a grip and move it to reorder.' : 'Hold a grip and move it to reorder.'}</Caption> : null}
      {batches.sheets}

      {nudge ? (
        <View style={[styles.nudge, { backgroundColor: ds.c.surface }]}>
          <Body>{`The name says ${nudge.phrase}. Make the ${draft.lines.find((l) => l.key === nudge.key)?.name} that way?`}</Body>
          <View style={styles.nudgeButtons}>
            <Button
              label="Make it house"
              onPress={() => {
                const line = draft.lines.find((l) => l.key === nudge.key);
                if (line) makeHouse(line, nudge.technique, nudge.adjunct);
              }}
            />
            <Button label="Not now" variant="secondary" onPress={() => setNudgeOff(true)} />
          </View>
        </View>
      ) : null}

      {removed ? (
        <View role="alert" style={[styles.undo, { backgroundColor: ds.c.raised }]}>
          <Body style={styles.flex} numberOfLines={1}>{`Removed ${removed.line.name}`}</Body>
          <Button label="Undo" variant="ghost" onPress={undo} accessibilityLabel={`Undo removing ${removed.line.name}`} />
        </View>
      ) : null}

      <IngredientSearch
        {...search}
        label={draft.lines.length ? 'Add another ingredient' : 'Add an ingredient'}
        placeholder={placeholder}
        amounts
        onPick={(pick, pour) => add(pick, undefined, false, pour)}
        onTyping={setTyping}
        onMake={forDrink ? (name, pour) => make(name, undefined, pour) : undefined}
        onLater={forDrink ? (name, pour) => add({ id: null, name: capitalizeFirst(name) }, undefined, true, pour) : undefined}
        captions={forDrink}
      />
      {/* In the flow under the field, so it never covers the balance or Goes with (canvas make-create-prep-back). */}
      {madePrep ? <WizardNotice>{madePrep}</WizardNotice> : null}
      <PrepBuilder
        name={makingName}
        drinkName={draft.name.trim()}
        initial={editingKey && !replacing ? draft.lines.find((l) => l.key === editingKey)?.prep : null}
        technique={makingTechnique}
        picked={makingBase ? { base: makingBase } : undefined}
        ingredients={ingredients}
        aliases={aliases}
        onClose={() => setMaking(null)}
        onDone={(prep) => {
          if (editingKey && replacing) change(editingKey, { id: null, name: makingName ?? '', prep, technique: prep.technique, later: undefined });
          else if (editingKey) change(editingKey, { prep, technique: prep.technique, later: undefined });
          else if (makingName) add({ id: null, name: makingName }, prep, false, makingPour);
          setMaking(null);
          // The prep is saved with the drink, not before, so this says when rather than "saved" (canvas make-create-house-line).
          if (!editingKey) setMadePrep(`${prepWord(prep, makingName ?? 'The prep')} saved to your preps when you save the drink. Its page is ready then.`);
          else if (replacing) setMadePrep(`Saved to your bar’s preps when you save the drink. Next time, type “${(makingName ?? '').split(/[\s-]/)[0].toLowerCase()}”.`);
        }}
        onLater={() => {
          if (editingKey) change(editingKey, { id: null, name: makingName ?? '', prep: undefined, technique: undefined, later: true });
          else if (makingName) add({ id: null, name: makingName }, undefined, true, makingPour);
          setMaking(null);
        }}
      />
      <MakeItHouseSheet
        bottle={houseLine?.name ?? null}
        ways={houseLine ? houseWays(houseLine.name, generic(houseLine.id)) : []}
        nudge={nudge && nudge.key === houseKey ? nudge : null}
        onPick={(t, adjunct) => houseLine && makeHouse(houseLine, t, adjunct)}
        onClose={() => setHouseKey(null)}
        tellUs={tellUs}
      />

      {/* The balance sits right under the field, then what goes with it (Flavor Atlas order). */}
      {forDrink && balance && !typing ? <BalanceCard lines={poured} ingredients={ingredients} onAdd={(name) => add(pickByName(name, ingredients))} /> : null}
      {typing || !forDrink ? null : <IngredientSuggestions draft={draft} set={set} poured={poured} ingredients={ingredients} onAdd={add} />}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  swap: { paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  nudge: { gap: space.md, borderRadius: radius.control, padding: space.lg },
  nudgeButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  undo: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.control, paddingLeft: space.lg, paddingRight: space.xs },
  flex: { flex: 1 },
});
