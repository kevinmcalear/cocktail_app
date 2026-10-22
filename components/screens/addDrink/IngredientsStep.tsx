import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { COMMON_INGREDIENTS, guessUnit, newLine, pickByName, type StepProps, type WizardLine, type WizardPick } from '@/lib/drinkWizard';
import { dropIndex } from '@/lib/dropIndex';
import { houseNudge, houseWays } from '@/lib/makeItHouse';
import type { IngredientAlias } from '@/lib/ingredientNames';
import { PREP_KINDS, type PrepDraft } from '@/lib/prepKinds';
import { suggestAmount } from '@/lib/specDefaults';
import { capitalizeFirst } from '@/lib/stringUtils';
import { techniqueById, type Technique } from '@/lib/techniques';
import { startsFrom } from '@/lib/techniques/makeIt';
import { nameFor } from '@/lib/techniques/template';
import { getPreferredUnit } from '@/store/useSettingsStore';

import { DragRow } from './DragRow';
import { BalanceCard, CloseToClassic, GoesWith } from './GoesWith';
import { IngredientSearch, type CatalogIngredient } from './IngredientSearch';
import { LineBottle, LineBottles, type LineBottlePlace } from './LineBottle';
import { LineRow } from './LineRow';
import { MakeItHouseSheet } from './MakeItHouseSheet';
import { PrepBuilder } from './prep/PrepBuilder';
import { StartFromClassic } from './StartFromClassic';
import { WizardChip, WizardNotice } from './WizardChrome';

/** How many quick adds show under the field. */
const QUICK = 8;
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
  lineDetail?: (line: WizardLine) => string | null;
  /** A bottle on each line that puts it on this venue's back bar, or your shelf at home. */
  bottles?: LineBottlePlace;
}

/**
 * The spec so far, each line editable where it is; a field to find an
 * ingredient (or add a new one); and suggestions: the common ones, what
 * goes with what's in it, a classic to start from, and a one-tap fix when
 * it's out of balance. Each new line starts at a likely pour.
 */
export function IngredientsStep({ draft, set, ingredients, loading, aliases = [], coreIds, forDrink = true, shelf, backBar, balance = true, lineDetail, bottles }: IngredientsStepProps) {
  const ds = useDs();
  const [typing, setTyping] = useState(false);
  const [swapKey, setSwapKey] = useState<string | null>(null);
  const [removed, setRemoved] = useState<{ line: WizardLine; at: number } | null>(null);
  /**
   * A house prep being made: a new line, the recipe of a line in the drink
   * (its key), or a line swapped for one (its key, `replace`). Make it house
   * on a bottle also brings the technique and the bottle as its base.
   */
  const [making, setMaking] = useState<{ name: string; key?: string; replace?: boolean; technique?: string; base?: WizardPick } | null>(null);
  // Plain values: the React Compiler reads `making.key` eagerly for its memo deps, which throws while it's closed.
  const editingKey = making?.key ?? null;
  const makingName = making?.name ?? null;
  const replacing = !!making?.replace;
  const makingTechnique = making?.technique ?? null;
  const makingBase = making?.base ?? null;
  /** The bottle line "What did you do to it?" is open for. */
  const [houseKey, setHouseKey] = useState<string | null>(null);
  const [nudgeOff, setNudgeOff] = useState(false);
  /** A prep just made in the builder: "Shrub saved to your preps…" for a moment. */
  const [madePrep, setMadePrep] = useState<string | null>(null);
  // Shown the way it saves ("coconut fat washed rum" is "Coconut fat washed rum").
  const make = (name: string, key?: string) => setMaking({ name: capitalizeFirst(name), key, replace: !!key });
  const generic = (id: string | null) => {
    const row = id ? ingredients.find((i) => i.id === id) : null;
    return row?.generic_id ? ingredients.find((i) => i.id === row.generic_id)?.name ?? null : null;
  };
  // Its generic's id (Mezcal's is Agave Spirit), for matching classics.
  const genericOf = (id: string) => ingredients.find((i) => i.id === id)?.generic_id ?? null;
  // Bottles a technique can change (a spirit, a juice), and what the drink's name says about one.
  const changeable = (l: WizardLine) => !!l.id && !!(startsFrom(l.name) ?? startsFrom(generic(l.id) ?? ''));
  const nudge = forDrink && !nudgeOff ? houseNudge(draft.name, draft.lines.map((l) => ({ ...l, styleName: generic(l.id) }))) : null;
  const houseLine = houseKey ? draft.lines.find((l) => l.key === houseKey) ?? null : null;
  const makeHouse = (line: WizardLine, t: Technique, adjunct: string | null) => {
    setHouseKey(null);
    setMaking({ name: nameFor(t, { base: line.name, adjunct }), key: line.key, replace: true, technique: t.id, base: { id: line.id, name: line.name } });
  };

  useEffect(() => {
    if (!removed) return;
    const t = setTimeout(() => setRemoved(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [removed]);
  useEffect(() => {
    if (!madePrep) return;
    const t = setTimeout(() => setMadePrep(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [madePrep]);

  const add = (pick: WizardPick, prep?: PrepDraft, later?: boolean) => {
    const unit = guessUnit(pick.name, getPreferredUnit());
    const amount = !forDrink ? '' : suggestAmount({ name: pick.name, genericName: generic(pick.id) }, unit, draft.lines.map((l) => ({ name: l.name, genericName: generic(l.id) })));
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
  const drop = (from: number, dy: number) => move(from, dropIndex(from, dy, draft.lines.map((l) => heights.current[l.key] ?? 0)));
  const has = (name: string) => draft.lines.some((l) => l.name.trim().toLowerCase() === name.toLowerCase());
  const quick = COMMON_INGREDIENTS.filter((n) => !has(n)).slice(0, QUICK);
  const search = { ingredients, aliases, coreIds, loading, shelf, backBar, brands: true };

  return (
    <View style={styles.stack}>
      {draft.lines.length ? (
        <LineBottles place={bottles} drinkName={draft.name} ingredients={ingredients}>
          <View role="list" aria-label="In the drink">
            {draft.lines.map((l, i) => (
              <DragRow key={l.key} index={i} onDrop={drop} onHeight={(h) => (heights.current[l.key] = h)}>
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
                  ) : (
                    <LineRow
                      line={l}
                      grip={grip}
                      lifted={lifted}
                      onMove={(by) => move(i, i + by)}
                      onChange={(c) => change(l.key, c)}
                      onRemove={() => remove(l)}
                      onSwap={() => setSwapKey(l.key)}
                      onEditPrep={() => setMaking({ name: l.name, key: l.key })}
                      onMakeHouse={forDrink && changeable(l) ? () => setHouseKey(l.key) : undefined}
                      detail={lineDetail?.(l)}
                      bottle={<LineBottle line={l} />}
                    />
                  )
                }
              </DragRow>
            ))}
          </View>
        </LineBottles>
      ) : null}
      {draft.lines.length > 1 ? <Caption tone="muted">{Platform.OS === 'web' ? 'Drag a grip to reorder.' : 'Hold a grip to reorder.'}</Caption> : null}

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
        onPick={add}
        onTyping={setTyping}
        onMake={forDrink ? (name) => make(name) : undefined}
        onLater={forDrink ? (name) => add({ id: null, name: capitalizeFirst(name) }, undefined, true) : undefined}
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
          else if (makingName) add({ id: null, name: makingName }, prep);
          setMaking(null);
          // The prep is saved with the drink, not before, so this says when rather than "saved" (canvas make-create-house-line).
          if (!editingKey) setMadePrep(`${prepWord(prep, makingName ?? 'The prep')} saved to your preps when you save the drink. Its page is ready then.`);
          else if (replacing) setMadePrep(`Saved to your bar’s preps when you save the drink. Next time, type “${(makingName ?? '').split(/[\s-]/)[0].toLowerCase()}”.`);
        }}
        onLater={() => {
          if (editingKey) change(editingKey, { id: null, name: makingName ?? '', prep: undefined, technique: undefined, later: true });
          else if (makingName) add({ id: null, name: makingName }, undefined, true);
          setMaking(null);
        }}
      />
      <MakeItHouseSheet
        bottle={houseLine?.name ?? null}
        ways={houseLine ? houseWays(houseLine.name, generic(houseLine.id)) : []}
        nudge={nudge && nudge.key === houseKey ? nudge : null}
        onPick={(t, adjunct) => houseLine && makeHouse(houseLine, t, adjunct)}
        onClose={() => setHouseKey(null)}
      />

      {/* The balance sits right under the field, then what goes with it (Flavor Atlas order). */}
      {forDrink && balance && !typing ? <BalanceCard lines={draft.lines} ingredients={ingredients} onAdd={(name) => add(pickByName(name, ingredients))} /> : null}
      {typing || !forDrink ? null : (
        <>
          <GoesWith
            lines={draft.lines}
            onAdd={add}
            fallback={
              <View role="group" accessibilityLabel="Quick adds" style={styles.chips}>
                {quick.map((n) => (
                  <WizardChip key={n} label={n} add kind="button" onPress={() => add(pickByName(n, ingredients))} />
                ))}
              </View>
            }
            after={<CloseToClassic ingredients={draft.lines.flatMap((l) => (l.id ? [{ id: l.id, generic: genericOf(l.id) }] : []))} riffOf={draft.riffOf} onRiff={(riffOf) => set({ riffOf })} />}
          />
          {draft.lines.length ? null : <StartFromClassic set={set} />}
        </>
      )}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
