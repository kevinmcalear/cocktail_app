import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import {
  FINISH_CHIPS, FINISH_UNITS, finishStart, GARNISH_CHIPS, newLine, pickByName, shownGarnishes, type FinishChip, type StepProps, type WizardLine, type WizardPick,
} from '@/lib/drinkWizard';
import type { IngredientAlias } from '@/lib/ingredientNames';
import { stepToFinish } from '@/lib/prepKinds';
import { capitalizeFirst } from '@/lib/stringUtils';

import { IngredientSearch, type CatalogIngredient } from './IngredientSearch';
import { LineRow } from './LineRow';
import { DrinkHouseMade } from './prep/DrinkHouseMade';
import { WizardChip } from './WizardChrome';

interface FinishStepProps extends StepProps {
  ingredients: readonly CatalogIngredient[];
  /** The venue the drink is for, whose Kit a house-made's ways are checked against; null at home. */
  bar?: { id: string; name: string } | null;
  loading?: boolean;
  aliases?: readonly IngredientAlias[];
  coreIds?: ReadonlySet<string>;
}

const same = (l: WizardLine, name: string, unit: string) => l.name.toLowerCase() === name.toLowerCase() && l.unit === unit;

/**
 * How the drink is finished: what goes on top (3 drops of mint oil, a mist,
 * an absinthe rinse, a float) and on the glass (a peel, a sprig). Each is a
 * spec line after the ingredients with its own amount and unit, the way
 * Service and the batch read a garnish. A garnish the catalog lacks (a lime
 * leaf, a salt, a flower) is added by its name; making it in house is there
 * too, and leads only for a name that sounds made (an oil, a cordial).
 */
export function FinishStep({ draft, set, ingredients, loading, aliases = [], coreIds, bar = null }: FinishStepProps) {
  const ds = useDs();
  // A chip that asks "of what?": its unit waits for what's picked in the search.
  const [asking, setAsking] = useState<FinishChip | null>(null);
  const [typing, setTyping] = useState(false);
  const [all, setAll] = useState(false);
  const [swapKey, setSwapKey] = useState<string | null>(null);
  // A house-made being written inside the drink (board Add-inside): its line in the finish (its key).
  // `fresh`: added from the search, so Don't keep it (or backing out with nothing kept) takes it out. `finished`: its recipe done before, and a change keeps it so.
  const [making, setMaking] = useState<{ name: string; key: string; fresh?: boolean; finished?: boolean } | null>(null);
  const lines = draft.garnishes;
  const search = { ingredients, aliases, coreIds, loading };
  const makingLine = making ? lines.find((l) => l.key === making.key) : undefined;

  const add = (pick: WizardPick, later?: boolean) => {
    const start = asking ?? finishStart(pick.name);
    // A new name starts with a capital ("Lime leaf"), as the save writes it.
    const named = pick.id ? pick : { ...pick, name: capitalizeFirst(pick.name.trim()) };
    const line = { ...newLine(named, start.unit, start.amount), ...(later ? { later } : null) };
    set({ garnishes: [...lines, line] });
    setAsking(null);
    return line;
  };
  const change = (key: string, c: Partial<WizardLine>) => set({ garnishes: lines.map((l) => (l.key === key ? { ...l, ...c } : l)) });
  const toggle = (name: string, unit: string, amount: string) => {
    const on = lines.find((l) => same(l, name, unit));
    set({ garnishes: on ? lines.filter((l) => l !== on) : [...lines, newLine(pickByName(name, ingredients), unit, amount)] });
  };
  const has = (name: string, unit: string) => lines.some((l) => same(l, name, unit));
  const garnishes = all ? GARNISH_CHIPS : shownGarnishes(draft.lines.map((l) => l.name), (c) => has(c.name, c.unit));

  return (
    <View style={styles.stack}>
      {lines.length ? (
        <View role="list" aria-label="The finish">
          {lines.map((l) =>
            l.key === swapKey ? (
              <View key={l.key} style={[styles.swap, { borderBottomColor: ds.c.line }]}>
                <IngredientSearch
                  {...search}
                  label={`Swap ${l.name} for…`}
                  autoFocus
                  nameFirst
                  onCancel={() => setSwapKey(null)}
                  onPick={(p) => {
                    change(l.key, { id: p.id, name: p.name, prep: undefined, technique: undefined });
                    setSwapKey(null);
                  }}
                />
              </View>
            ) : (
              <LineRow
                key={l.key}
                line={l}
                units={FINISH_UNITS}
                onChange={(c) => change(l.key, c)}
                onRemove={() => set({ garnishes: lines.filter((x) => x.key !== l.key) })}
                onSwap={() => setSwapKey(l.key)}
                onEditPrep={() => setMaking({ name: l.name, key: l.key, finished: !!l.prep && !l.prep.at && !l.later })}
              />
            )
          )}
        </View>
      ) : null}

      <IngredientSearch
        {...search}
        // A new key focuses the field when a chip asks "of what?".
        key={asking?.label ?? 'finish'}
        autoFocus={!!asking}
        label={asking?.ask ?? 'Search for a garnish'}
        makeFirst
        nameFirst
        onPick={(pick) => add(pick)}
        onTyping={setTyping}
        onMake={(name) => {
          const line = add({ id: null, name }, true);
          setMaking({ name: line.name, key: line.key, fresh: true });
        }}
      />
      {making && makingLine ? (
        <DrinkHouseMade
          key={making.key}
          name={making.name}
          initial={makingLine.prep ?? null}
          drinkName={draft.name.trim() || 'Your drink'}
          forDrink
          drafts
          above={[{ label: draft.name.trim() || 'Your drink' }]}
          bar={bar}
          ingredients={ingredients}
          aliases={aliases}
          finished={!!making.finished}
          // A recipe to finish until Done (a finished one stays finished while it could be added as it is).
          onKeep={(prep, name, done) => change(making.key, { name, prep: { ...prep, at: done && making.finished ? undefined : stepToFinish(prep) }, technique: prep.technique, later: undefined })}
          onDone={(prep, name) => {
            change(making.key, { name, prep: { ...prep, at: undefined }, technique: prep.technique, later: undefined });
            setMaking(null);
          }}
          onClose={(kept) => {
            if (making.fresh && !kept && !makingLine.prep) set({ garnishes: lines.filter((l) => l.key !== making.key) });
            setMaking(null);
          }}
          // Don't keep it, on Leave it for now?: a garnish added from the search goes again.
          onDrop={
            making.fresh
              ? () => {
                  set({ garnishes: lines.filter((l) => l.key !== making.key) });
                  setMaking(null);
                }
              : undefined
          }
          onUse={(id, name) => {
            change(making.key, { id, name, prep: undefined, technique: undefined, later: undefined });
            setMaking(null);
          }}
        />
      ) : null}

      {typing ? null : (
        <>
          <View style={styles.group}>
            <Caption tone="muted">Garnish</Caption>
            <View role="group" aria-label="Garnish" style={styles.chips}>
              {garnishes.map((c) => (
                <WizardChip key={c.label} kind="checkbox" label={c.label} selected={has(c.name, c.unit)} onPress={() => toggle(c.name, c.unit, c.amount)} />
              ))}
              {garnishes.length < GARNISH_CHIPS.length ? <WizardChip label="More" kind="button" dashed onPress={() => setAll(true)} /> : null}
            </View>
          </View>
          <View style={styles.group}>
            <Caption tone="muted">Drops, mist, rinse</Caption>
            <View role="group" aria-label="Drops, mist, rinse" style={styles.chips}>
              {FINISH_CHIPS.map((c) => (
                <WizardChip
                  key={c.label}
                  kind="checkbox"
                  label={c.label}
                  selected={c.name ? has(c.name, c.unit) : asking?.label === c.label}
                  onPress={() => (c.name ? toggle(c.name, c.unit, c.amount) : setAsking(asking?.label === c.label ? null : c))}
                />
              ))}
            </View>
          </View>
          <Caption tone="muted">A discard is a peel expressed over the drink and thrown away: the oils stay, the peel doesn’t, so the drawing shows none.</Caption>
          <Caption tone="muted">The finish goes at the end of the spec.</Caption>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  swap: { paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
});
