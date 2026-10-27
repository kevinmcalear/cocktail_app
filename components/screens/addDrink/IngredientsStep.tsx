import { useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { useExpiring } from '@/hooks/useExpiring';
import { linePrep, perDrinkLines } from '@/lib/batchLines';
import { toggleLine } from '@/lib/drinkParts';
import { guessUnit, newLine, pickByName, typedUnit, type StepProps, type WizardLine, type WizardPick } from '@/lib/drinkWizard';
import { houseNudge, houseWord } from '@/lib/makeItHouse';
import type { IngredientAlias } from '@/lib/ingredientNames';
import type { TypedPour } from '@/lib/paste';
import { bottleKindRow, guessBottleKind } from '@/lib/newBottle';
import type { PrepDraft } from '@/lib/prepKinds';
import { suggestAmount, tidyAmount } from '@/lib/specDefaults';
import { capitalizeFirst } from '@/lib/stringUtils';
import type { Technique } from '@/lib/techniques';
import { looksMadeInHouse } from '@/lib/techniques/makeIt';
import { nameFor } from '@/lib/techniques/template';
import { getPreferredUnit } from '@/store/useSettingsStore';

import type { TrailItem } from './Trail';
import { DragRow, SpecRows } from './DragRow';
import { NudgeCard } from './NudgeCard';
import { BalanceCard } from './GoesWith';
import { IngredientSearch, type CatalogIngredient } from './IngredientSearch';
import { IngredientSuggestions } from './IngredientSuggestions';
import { LineChoices, unmatched } from './LineChoices';
import { LineRow } from './LineRow';
import { PasteSpecPanel } from './PasteSpecPanel';
import { SalineHint } from './SalineHint';
import type { LineStock } from './StockToggle';
import { useCombineDrop } from './useCombineDrop';
import { useMakePrep } from './useMakePrep';
import { useTypedHouse } from './useTypedHouse';
import { WizardNotice } from './WizardChrome';
import { useWizardTakeover } from './WizardFrame';

/** How long "Removed … Undo" stays. */
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
  /** The add field's hint, when it says more than "Add an ingredient" (the desktop page's "30 pommeau" works too). */
  placeholder?: string;
  /** The desktop page: "Add “X”, a bottle you buy" adds the line with its card open under it (this line's key). */
  onNewBottle?: (key: string) => void;
  /** The desktop page: a house prep is written under its own line, not over the page. */
  inlinePrep?: { venueName: string | null; onOpen?: (making: string | null) => void };
  /** The venue the drink is for, whose Kit a recipe's ways are checked against; null at home. */
  bar?: { id: string; name: string } | null;
  /** Where the drink is, from the menu down to it, for a recipe's trail. */
  trail?: readonly TrailItem[];
  /** The editors (drink-edit-phone): the lines and the search only, no suggestions or paste. Bumping `focus` (their Line button) puts the cursor in the search. */
  editing?: boolean;
  focus?: number;
  /** The drink editor made in parts (drink-edit-parts): a part's heading. Each part's lines sit under it, with its own Add field (draft.parts). */
  partHead?: (part: number) => ReactNode;
}

/**
 * The spec so far, each line editable where it is; a field to find an
 * ingredient, add a new one or make one in house; and suggestions: the
 * common ones, what goes with what's in it, a classic to start from, and a
 * one-tap fix when it's out of balance. Each new line starts at a likely
 * pour. Making anything in house is the one recipe flow
 * (make-anything-overview): from the search, or by holding one line over
 * another to combine them.
 */
export function IngredientsStep({ draft, set, ingredients, loading, aliases = [], coreIds, forDrink = true, shelf, backBar, balance = true, lineDetail, lineBelow, stock, placeholder, onNewBottle, inlinePrep, bar, trail, editing, focus, partHead }: IngredientsStepProps) {
  const ds = useDs();
  // Made in parts: the part whose Add field was used last, which a new line goes into.
  const parts = partHead && draft.parts?.length ? draft.parts : null;
  const into = useRef(1);
  const partName = (p: number) => parts?.[p - 1]?.name.trim() || `part ${p}`;
  // On a phone the add field takes the screen while it's in use (Q16): the rest goes to null in place, so the field keeps its focus. There's no typing outside it.
  const takeover = useWizardTakeover();
  const [typing, setTyping] = useState(false);
  const searching = takeover ? takeover.on : false;
  const quiet = takeover ? takeover.on : typing;
  const [swapKey, setSwapKey] = useState<string | null>(null);
  const [removed, setRemoved] = useExpiring<{ line: WizardLine; at: number }>(UNDO_MS);
  const [nudgeOff, setNudgeOff] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [toFinish, setToFinish] = useExpiring<string>(UNDO_MS);
  const generic = (id: string | null) => {
    const row = id ? ingredients.find((i) => i.id === id) : null;
    return row?.generic_id ? ingredients.find((i) => i.id === row.generic_id)?.name ?? null : null;
  };
  // What the drink's name says about one of its bottles ("Coconut Fat-Washed Daiquiri").
  const nameNudge = forDrink && !nudgeOff ? houseNudge(draft.name, draft.lines.map((l) => ({ ...l, styleName: generic(l.id) }))) : null;
  // A bottle made in house by a technique; `ask` opens on What is it, to check how first.
  const makeHouse = (line: WizardLine, t: Technique, adjunct: string | null, ask?: boolean) => {
    typed.drop(line.key);
    prep.house(line, nameFor(t, { base: line.name, adjunct }), t.id, ask);
  };

  // A pour typed with the name ("30 pommeau") is the line's; otherwise it starts at a likely one.
  const lineFor = (pick: WizardPick, pour?: TypedPour): WizardLine => {
    const guess = pour ? typedUnit(pick.name, pour.unit, getPreferredUnit()) : guessUnit(pick.name, getPreferredUnit());
    // A house recipe is never topped (lib/unitGuess.ts prepUnit).
    const unit = !forDrink && guess === 'top' ? getPreferredUnit() : guess;
    const amount = pour ? tidyAmount(pour.amount) : !forDrink ? '' : suggestAmount({ name: pick.name, genericName: generic(pick.id) }, unit, draft.lines.map((l) => ({ name: l.name, genericName: generic(l.id) })));
    return newLine(pick, unit, amount);
  };
  const add = (pick: WizardPick, prep?: PrepDraft, later?: boolean, pour?: TypedPour, more?: Partial<WizardLine>): WizardLine => {
    const line = { ...lineFor(pick, pour), ...(prep ? { prep, technique: prep.technique } : null), ...(later ? { later: true } : null), ...more };
    set({ lines: [...draft.lines, line], ...(parts ? { parts: toggleLine(parts, Math.min(into.current, parts.length) - 1, line.key) } : null) });
    setRemoved(null);
    return line;
  };
  // A bottle you buy, with what its name says it is, filled in on its card under the line.
  const core = ingredients.filter((i) => coreIds?.has(i.id));
  const bottleFor = (name: string): WizardLine['bottle'] => {
    const kind = guessBottleKind(name);
    return { kind, kindId: bottleKindRow(name, kind, core, ingredients)?.id ?? null, abv: '', supplier: null, packAmount: '', packUnit: 'ml', packPrice: '' };
  };
  const newBottle = (name: string, pour?: TypedPour) => onNewBottle?.(add({ id: null, name }, undefined, false, pour, { bottle: bottleFor(name) }).key);
  const change = (key: string, c: Partial<WizardLine>) => set({ lines: draft.lines.map((l) => (l.key === key ? { ...l, ...c } : l)) });
  const remove = (line: WizardLine) => {
    setRemoved({ line, at: draft.lines.indexOf(line) });
    set({ lines: draft.lines.filter((x) => x.key !== line.key) });
  };
  const prep = useMakePrep({ draft, set, ingredients, aliases, inlinePrep, add, change, bar, trail });
  // Lines typed or pasted as made house ask first, then the drink's name does.
  const typed = useTypedHouse({ draft, set, lineFor, add: (pick, pour) => add(pick, undefined, false, pour), makeHouse });
  const nudge = typed.next ?? nameNudge;
  const nudgeLine = nudge ? draft.lines.find((l) => l.key === nudge.key) : undefined;
  const make = prep.make;
  const undo = () => {
    if (!removed) return;
    const lines = [...draft.lines];
    lines.splice(Math.min(removed.at, lines.length), 0, removed.line);
    set({ lines });
    setRemoved(null);
  };
  // The others slide aside to show where a held line lands; held over another for the dwell, the two combine into a house prep and its steps open. In parts, past a heading it moves to that part.
  const combine = useCombineDrop({ draft, set, enabled: forDrink, onCombined: prep.edit, parted: !!parts });
  // The taste and what goes with it read one drink's own lines, not the batch.
  const poured = perDrinkLines(draft.lines);
  const search = { ingredients, aliases, coreIds, loading, shelf, backBar, brands: true };

  // Pasting takes the step's place, right under its heading, so the box sits above the keyboard (canvas make-create-finish-oil, step 4).
  if (pasting) {
    return <PasteSpecPanel onClose={() => setPasting(false)} drinkName={draft.name} {...search} have={backBar ?? shelf} haveLabel={backBar ? 'On your back bar' : 'On your shelf'} onAdd={(rows) => setToFinish(typed.paste(rows).join(', ') || null)} />;
  }

  // A field to add a line: in parts each part has its own, and a new line goes in the part it's under.
  const addField = (part?: number) => (
    <IngredientSearch
      {...search}
      key={part && part < (parts?.length ?? 0) ? `add:${part}` : focus}
      autoFocus={!!focus && !(part && part < (parts?.length ?? 0))}
      label={part ? `Add to ${partName(part)}` : draft.lines.length ? 'Add another ingredient' : 'Add an ingredient'}
      placeholder={placeholder}
      amounts
      onPick={(pick, pour, named) => add(pick, undefined, false, pour, named ? { named } : undefined)}
      onTyping={(on) => ((into.current = on && part ? part : into.current), setTyping(on))}
      onMake={forDrink ? (name, pour) => make(name, undefined, pour) : undefined}
      onBottle={forDrink && onNewBottle ? newBottle : undefined}
      onLater={forDrink ? (name, pour) => add({ id: null, name: capitalizeFirst(name) }, undefined, true, pour) : undefined}
      onHouse={forDrink ? typed.typed : undefined}
      captions={forDrink}
      takeover={takeover ? { ...takeover, caption: `Adding to ${draft.name.trim() || 'your drink'}` } : null}
    />
  );

  return (
    <View style={styles.stack}>
      {parts && partHead && !searching ? partHead(1) : null}
      {(draft.lines.length || parts) && !searching ? (
        <SpecRows entries={combine.entries} shift={combine.shift} onHeight={combine.height} head={(p) => (<>{addField(p - 1)}{partHead?.(p)}</>)}>
          {(i, row) => {
            const l = draft.lines[i];
            return (
              <DragRow key={l.key} index={row} fold onDrop={combine.onDrop} onMove={combine.onMove} shift={combine.shift(row)} flat={combine.combineWith(i) !== null} onHeight={(h) => combine.height({ line: i }, h)}>
                {(grip, lifted) =>
                  // The lines keep their size while the next one is searched: folding them read as squeezed (Eddie, 16 Oct).
                  l.key === swapKey ? (
                    <View style={[styles.swap, { borderBottomColor: ds.c.line }]}>
                      <IngredientSearch
                        {...search}
                        label={`Rename ${l.name} or pick another`}
                        initial={l.name}
                        autoFocus
                        onCancel={() => setSwapKey(null)}
                        onPick={(p, _pour, named) => {
                          // A different ingredient isn't the house prep that was here.
                          change(l.key, { id: p.id, name: p.name, prep: undefined, technique: undefined, bottle: undefined, named: named || undefined });
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
                  ) : (
                    <LineRow
                      // A batch read from a file shows, and opens, as the house prep it saves as.
                      line={l.batch ? { ...l, prep: linePrep(l) } : l}
                      grip={grip}
                      lifted={lifted}
                      dropTarget={combine.target === i ? combine.holding : null}
                      combineWith={combine.combineWith(i)}
                      moveTo={combine.moveTo ? partName(combine.moveTo) : null}
                      onMove={(by) => combine.step(row, by)}
                      onChange={(c) => change(l.key, c)}
                      onRemove={() => remove(l)}
                      onSwap={() => setSwapKey(l.key)}
                      onEditPrep={() => prep.edit(l)}
                      detail={lineDetail?.(l)}
                      below={
                        <>
                          {lineBelow?.(l)}
                          {forDrink ? <SalineHint line={l} ingredients={ingredients} onChange={(c) => change(l.key, c)} /> : null}
                          {/* A line that matched nothing asks what it is, until its recipe opens under it (step 10). */}
                          {prep.card(l.key) ??
                            (forDrink && unmatched(l) ? (
                              <LineChoices
                                line={l}
                                venueName={bar?.name ?? null}
                                onMake={(name) => make(name, l.key)}
                                onBottle={() => {
                                  change(l.key, { bottle: bottleFor(l.name) });
                                  onNewBottle?.(l.key);
                                }}
                                // As the search's "Just add the name": one that sounds made here is a recipe to write later.
                                onName={() => change(l.key, houseWord(l.name) || looksMadeInHouse(l.name) ? { later: true } : { named: true })}
                              />
                            ) : null)}
                        </>
                      }
                      stock={stock?.toggle(l)}
                    />
                  )
                }
              </DragRow>
            );
          }}
        </SpecRows>
      ) : null}
      {searching ? null : stock?.footer}
      {/* In parts the editor says it under Add a part (drink-edit-parts). */}
      {draft.lines.length > 1 && !parts && !searching ? <Caption tone="muted">{`Hold a line${Platform.OS === 'web' ? ' by its grip' : ''} and move it ${forDrink ? 'over another. Let go to combine them; move away to just reorder.' : 'to reorder.'}`}</Caption> : null}

      {nudge && !searching ? (
        <NudgeCard nudge={nudge} name={nudgeLine?.name} onMake={() => nudgeLine && makeHouse(nudgeLine, nudge.technique, nudge.adjunct)} onNotNow={() => (nudge.from === 'typed' ? typed.drop(nudge.key) : setNudgeOff(true))} />
      ) : null}

      {removed && !searching ? (
        <View role="alert" style={[styles.undo, { backgroundColor: ds.c.raised }]}>
          <Body style={styles.flex} numberOfLines={1}>{`Removed ${removed.line.name}`}</Body>
          <Button label="Undo" variant="ghost" onPress={undo} accessibilityLabel={`Undo removing ${removed.line.name}`} />
        </View>
      ) : null}

      {addField(parts?.length)}
      {forDrink && !quiet && !editing ? <Button label="Paste a whole spec" variant="ghost" size="sm" style={styles.paste} onPress={() => setPasting(true)} /> : null}
      {toFinish && !searching ? <WizardNotice>{`${toFinish} went to the finish.`}</WizardNotice> : null}
      {prep.builder}

      {/* The balance sits right under the field, then what goes with it (Flavor Atlas order). */}
      {forDrink && balance && !quiet && !editing ? <BalanceCard lines={poured} ingredients={ingredients} onAdd={(name) => add(pickByName(name, ingredients))} /> : null}
      {quiet || !forDrink || editing ? null : <IngredientSuggestions draft={draft} set={set} poured={poured} ingredients={ingredients} onAdd={add} />}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  swap: { paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  undo: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderRadius: radius.control, paddingLeft: space.lg, paddingRight: space.xs },
  flex: { flex: 1 },
  paste: { alignSelf: 'flex-start' },
});
