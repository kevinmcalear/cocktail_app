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
import { bottleKindRow, guessBottleKind } from '@/lib/newBottle';
import type { PrepDraft } from '@/lib/prepKinds';
import { suggestAmount, tidyAmount } from '@/lib/specDefaults';
import { capitalizeFirst } from '@/lib/stringUtils';
import type { Technique } from '@/lib/techniques';
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
import { PasteSpecPanel } from './PasteSpecPanel';
import type { LineStock } from './StockToggle';
import { useBatchDrop } from './useBatchDrop';
import { useMakePrep } from './useMakePrep';
import { useTypedHouse } from './useTypedHouse';
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
  /** The desktop page: "Add “X”, a bottle you buy" adds the line with its card open under it (this line's key). */
  onNewBottle?: (key: string) => void;
  /** The desktop page: a house prep is written under its own line, not over the page. */
  inlinePrep?: { venueName: string | null };
}

/**
 * The spec so far, each line editable where it is; a field to find an
 * ingredient (or add a new one); and suggestions: the common ones, what
 * goes with what's in it, a classic to start from, and a one-tap fix when
 * it's out of balance. Each new line starts at a likely pour.
 */
export function IngredientsStep({ draft, set, ingredients, loading, aliases = [], coreIds, forDrink = true, shelf, backBar, balance = true, lineDetail, lineBelow, stock, tellUs, placeholder, onNewBottle, inlinePrep }: IngredientsStepProps) {
  const ds = useDs();
  const [typing, setTyping] = useState(false);
  const [swapKey, setSwapKey] = useState<string | null>(null);
  const [removed, setRemoved] = useExpiring<{ line: WizardLine; at: number }>(UNDO_MS);
  /** The bottle line "What did you do to it?" is open for. */
  const [houseKey, setHouseKey] = useState<string | null>(null);
  const [nudgeOff, setNudgeOff] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [toFinish, setToFinish] = useExpiring<string>(UNDO_MS);
  const generic = (id: string | null) => {
    const row = id ? ingredients.find((i) => i.id === id) : null;
    return row?.generic_id ? ingredients.find((i) => i.id === row.generic_id)?.name ?? null : null;
  };
  // Bottles a technique can change (a spirit, a juice), and what the drink's name says about one.
  const changeable = (l: WizardLine) => !!l.id && !!(startsFrom(l.name) ?? startsFrom(generic(l.id) ?? ''));
  const nameNudge = forDrink && !nudgeOff ? houseNudge(draft.name, draft.lines.map((l) => ({ ...l, styleName: generic(l.id) }))) : null;
  const houseLine = houseKey ? draft.lines.find((l) => l.key === houseKey) ?? null : null;
  const makeHouse = (line: WizardLine, t: Technique, adjunct: string | null) => {
    setHouseKey(null);
    typed.drop(line.key);
    prep.house(line, nameFor(t, { base: line.name, adjunct }), t.id);
  };

  // A pour typed with the name ("30 pommeau") is the line's; otherwise it starts at a likely one.
  const lineFor = (pick: WizardPick, pour?: TypedPour): WizardLine => {
    const unit = pour ? typedUnit(pick.name, pour.unit, getPreferredUnit()) : guessUnit(pick.name, getPreferredUnit());
    const amount = pour ? tidyAmount(pour.amount) : !forDrink ? '' : suggestAmount({ name: pick.name, genericName: generic(pick.id) }, unit, draft.lines.map((l) => ({ name: l.name, genericName: generic(l.id) })));
    return newLine(pick, unit, amount);
  };
  const add = (pick: WizardPick, prep?: PrepDraft, later?: boolean, pour?: TypedPour, more?: Partial<WizardLine>): WizardLine => {
    const line = { ...lineFor(pick, pour), ...(prep ? { prep, technique: prep.technique } : null), ...(later ? { later: true } : null), ...more };
    set({ lines: [...draft.lines, line] });
    setRemoved(null);
    return line;
  };
  // A bottle you buy, with what its name says it is, filled in on its card under the line.
  const core = ingredients.filter((i) => coreIds?.has(i.id));
  const newBottle = (name: string, pour?: TypedPour) => {
    const kind = guessBottleKind(name);
    const line = add({ id: null, name }, undefined, false, pour, {
      bottle: { kind, kindId: bottleKindRow(name, kind, core, ingredients)?.id ?? null, abv: '', supplier: null, packAmount: '', packUnit: 'ml', packPrice: '' },
    });
    onNewBottle?.(line.key);
  };
  const change = (key: string, c: Partial<WizardLine>) => set({ lines: draft.lines.map((l) => (l.key === key ? { ...l, ...c } : l)) });
  const remove = (line: WizardLine) => {
    setRemoved({ line, at: draft.lines.indexOf(line) });
    set({ lines: draft.lines.filter((x) => x.key !== line.key) });
  };
  const prep = useMakePrep({ draft, ingredients, aliases, inlinePrep, add, change });
  // Lines typed or pasted as made house ask first, then the drink's name does.
  const typed = useTypedHouse({ draft, set, lineFor, add: (pick, pour) => add(pick, undefined, false, pour), makeHouse, ask: setHouseKey });
  const nudge = typed.next ?? nameNudge;
  const make = prep.make;
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

  // Pasting takes the step's place, right under its heading, so the box sits above the keyboard (canvas make-create-finish-oil, step 4).
  if (pasting) {
    return (
      <PasteSpecPanel
        onClose={() => setPasting(false)}
        drinkName={draft.name}
        {...search}
        have={backBar ?? shelf}
        haveLabel={backBar ? 'On your back bar' : 'On your shelf'}
        onAdd={(rows) => setToFinish(typed.paste(rows).join(', ') || null)}
      />
    );
  }

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
                        change(l.key, { id: p.id, name: p.name, prep: undefined, technique: undefined, bottle: undefined });
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
                    onEditPrep={() => prep.edit(l)}
                    onMakeHouse={forDrink && changeable(l) ? () => setHouseKey(l.key) : undefined}
                    detail={lineDetail?.(l)}
                    below={
                      <>
                        {lineBelow?.(l)}
                        {prep.card(l.key)}
                      </>
                    }
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
          <Body>{`${nudge.from === 'typed' ? 'You wrote' : 'The name says'} ${nudge.phrase}. Make the ${draft.lines.find((l) => l.key === nudge.key)?.name} that way?`}</Body>
          <View style={styles.nudgeButtons}>
            <Button
              label="Make it house"
              onPress={() => {
                const line = draft.lines.find((l) => l.key === nudge.key);
                if (line) makeHouse(line, nudge.technique, nudge.adjunct);
              }}
            />
            <Button label="Not now" variant="secondary" onPress={() => (nudge.from === 'typed' ? typed.drop(nudge.key) : setNudgeOff(true))} />
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
        onBottle={forDrink && onNewBottle ? newBottle : undefined}
        onLater={forDrink ? (name, pour) => add({ id: null, name: capitalizeFirst(name) }, undefined, true, pour) : undefined}
        onHouse={forDrink ? typed.typed : undefined}
        captions={forDrink}
      />
      {forDrink && !typing ? <Button label="Paste a whole spec" variant="ghost" size="sm" style={styles.paste} onPress={() => setPasting(true)} /> : null}
      {toFinish ? <WizardNotice>{`${toFinish} went to the finish.`}</WizardNotice> : null}
      {/* In the flow under the field, so it never covers the balance or Goes with (canvas make-create-prep-back). */}
      {prep.made ? <WizardNotice>{prep.made}</WizardNotice> : null}
      {prep.builder}
      <MakeItHouseSheet
        bottle={houseLine?.name ?? null}
        ways={houseLine ? houseWays(houseLine.name, generic(houseLine.id)) : []}
        nudge={typed.forLine(houseKey) ?? (nameNudge && nameNudge.key === houseKey ? nameNudge : null)}
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
  paste: { alignSelf: 'flex-start' },
});
