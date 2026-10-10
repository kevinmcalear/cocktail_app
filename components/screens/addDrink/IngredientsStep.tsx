import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, useDs } from '@/components/ds';
import { radius, space } from '@/constants/tokens';
import { COMMON_INGREDIENTS, guessUnit, newLine, pickByName, type StepProps, type WizardLine, type WizardPick } from '@/lib/drinkWizard';
import { houseNudge, houseWays } from '@/lib/makeItHouse';
import type { IngredientAlias } from '@/lib/ingredientNames';
import type { PrepDraft } from '@/lib/prepKinds';
import { suggestAmount } from '@/lib/specDefaults';
import { capitalize } from '@/lib/stringUtils';
import type { Technique } from '@/lib/techniques';
import { startsFrom } from '@/lib/techniques/makeIt';
import { nameFor } from '@/lib/techniques/template';
import { getPreferredUnit } from '@/store/useSettingsStore';

import { BalanceCard, GoesWith } from './GoesWith';
import { IngredientSearch, type CatalogIngredient } from './IngredientSearch';
import { LineRow } from './LineRow';
import { MakeItHouseSheet } from './MakeItHouseSheet';
import { PrepBuilder } from './prep/PrepBuilder';
import { StartFromClassic } from './StartFromClassic';
import { WizardChip } from './WizardChrome';

/** How many quick adds show under the field. */
const QUICK = 8;
/** How long "Removed … Undo" stays. */
const UNDO_MS = 10000;

interface IngredientsStepProps extends StepProps {
  ingredients: readonly CatalogIngredient[];
  loading?: boolean;
  aliases?: readonly IngredientAlias[];
  coreIds?: ReadonlySet<string>;
  /** Off for a house recipe (a syrup, a batch): no cocktail pours, pairings, classics or balance. */
  forDrink?: boolean;
}

/**
 * The spec so far, each line editable where it is; a field to find an
 * ingredient (or add a new one); and suggestions: the common ones, what
 * goes with what's in it, a classic to start from, and a one-tap fix when
 * it's out of balance. Each new line starts at a likely pour.
 */
export function IngredientsStep({ draft, set, ingredients, loading, aliases = [], coreIds, forDrink = true }: IngredientsStepProps) {
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
  // Shown the way it saves ("coconut fat washed rum" is "Coconut Fat Washed Rum").
  const make = (name: string, key?: string) => setMaking({ name: capitalize(name), key, replace: !!key });
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

  useEffect(() => {
    if (!removed) return;
    const t = setTimeout(() => setRemoved(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [removed]);

  const add = (pick: WizardPick, prep?: PrepDraft) => {
    const unit = guessUnit(pick.name, getPreferredUnit());
    const amount = !forDrink ? '' : suggestAmount({ name: pick.name, genericName: generic(pick.id) }, unit, draft.lines.map((l) => ({ name: l.name, genericName: generic(l.id) })));
    set({ lines: [...draft.lines, { ...newLine(pick, unit, amount), ...(prep ? { prep, technique: prep.technique } : null) }] });
    setRemoved(null);
  };
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
  const has = (name: string) => draft.lines.some((l) => l.name.trim().toLowerCase() === name.toLowerCase());
  const quick = COMMON_INGREDIENTS.filter((n) => !has(n)).slice(0, QUICK);
  const search = { ingredients, aliases, coreIds, loading };

  return (
    <View style={styles.stack}>
      {draft.lines.length ? (
        <View role="list" aria-label="In the drink">
          {draft.lines.map((l) =>
            l.key === swapKey ? (
              <View key={l.key} style={[styles.swap, { borderBottomColor: ds.c.line }]}>
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
                key={l.key}
                line={l}
                onChange={(c) => change(l.key, c)}
                onRemove={() => remove(l)}
                onSwap={() => setSwapKey(l.key)}
                onEditPrep={() => setMaking({ name: l.name, key: l.key })}
                onMakeHouse={forDrink && changeable(l) ? () => setHouseKey(l.key) : undefined}
              />
            )
          )}
        </View>
      ) : null}

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

      <IngredientSearch {...search} label={draft.lines.length ? 'Add another ingredient' : 'Add an ingredient'} onPick={add} onTyping={setTyping} onMake={forDrink ? (name) => make(name) : undefined} />
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
          if (editingKey && replacing) change(editingKey, { id: null, name: makingName ?? '', prep, technique: prep.technique });
          else if (editingKey) change(editingKey, { prep, technique: prep.technique });
          else if (makingName) add({ id: null, name: makingName }, prep);
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
          />
          {draft.lines.length ? null : <StartFromClassic set={set} />}
        </>
      )}
      {forDrink ? <BalanceCard lines={draft.lines} ingredients={ingredients} onAdd={(name) => add(pickByName(name, ingredients))} /> : null}
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
