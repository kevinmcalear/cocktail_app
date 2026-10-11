import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import {
  FINISH_CHIPS, FINISH_UNITS, finishStart, GARNISH_CHIPS, newLine, pickByName, type FinishChip, type StepProps, type WizardLine, type WizardPick,
} from '@/lib/drinkWizard';
import type { IngredientAlias } from '@/lib/ingredientNames';
import type { PrepDraft } from '@/lib/prepKinds';
import { capitalize } from '@/lib/stringUtils';

import { IngredientSearch, type CatalogIngredient } from './IngredientSearch';
import { LineRow } from './LineRow';
import { PrepBuilder } from './prep/PrepBuilder';
import { Eyebrow, WizardChip } from './WizardChrome';

/** Garnish chips shown before More. */
const SHOWN = 8;

interface FinishStepProps extends StepProps {
  ingredients: readonly CatalogIngredient[];
  loading?: boolean;
  aliases?: readonly IngredientAlias[];
  coreIds?: ReadonlySet<string>;
}

const same = (l: WizardLine, name: string, unit: string) => l.name.toLowerCase() === name.toLowerCase() && l.unit === unit;

/**
 * How the drink is finished: what goes on top (3 drops of mint oil, a mist,
 * an absinthe rinse, a float) and on the glass (a peel, a sprig). Each is a
 * spec line after the ingredients with its own amount and unit, the way
 * Service and the batch read a garnish; anything the shelf lacks can be made
 * in house right here.
 */
export function FinishStep({ draft, set, ingredients, loading, aliases = [], coreIds }: FinishStepProps) {
  const ds = useDs();
  // A chip that asks "of what?": its unit waits for what's picked in the search.
  const [asking, setAsking] = useState<FinishChip | null>(null);
  const [typing, setTyping] = useState(false);
  const [all, setAll] = useState(false);
  const [swapKey, setSwapKey] = useState<string | null>(null);
  // A house prep being made: a new line, or the recipe of one in the finish (its key).
  const [making, setMaking] = useState<{ name: string; key?: string } | null>(null);
  // Plain values: the React Compiler reads `making.key` eagerly for its memo deps, which throws while it's closed.
  const makingName = making?.name ?? null;
  const editingKey = making?.key ?? null;
  const lines = draft.garnishes;
  const search = { ingredients, aliases, coreIds, loading };

  const add = (pick: WizardPick, prep?: PrepDraft) => {
    const start = asking ?? finishStart(pick.name);
    set({ garnishes: [...lines, { ...newLine(pick, start.unit, start.amount), ...(prep ? { prep, technique: prep.technique } : null) }] });
    setAsking(null);
  };
  const change = (key: string, c: Partial<WizardLine>) => set({ garnishes: lines.map((l) => (l.key === key ? { ...l, ...c } : l)) });
  const toggle = (name: string, unit: string, amount: string) => {
    const on = lines.find((l) => same(l, name, unit));
    set({ garnishes: on ? lines.filter((l) => l !== on) : [...lines, newLine(pickByName(name, ingredients), unit, amount)] });
  };
  const has = (name: string, unit: string) => lines.some((l) => same(l, name, unit));
  const garnishes = all ? GARNISH_CHIPS : GARNISH_CHIPS.filter((c, i) => i < SHOWN || has(c.name, c.unit));

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
                onEditPrep={() => setMaking({ name: l.name, key: l.key })}
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
        label={asking?.ask ?? 'Add to the finish'}
        makeFirst
        onPick={add}
        onTyping={setTyping}
        onMake={(name) => setMaking({ name: capitalize(name) })}
      />
      <PrepBuilder
        name={makingName}
        drinkName={draft.name.trim()}
        initial={editingKey ? lines.find((l) => l.key === editingKey)?.prep : null}
        ingredients={ingredients}
        aliases={aliases}
        onClose={() => setMaking(null)}
        onDone={(prep) => {
          if (editingKey) change(editingKey, { prep, technique: prep.technique });
          else if (makingName) add({ id: null, name: makingName }, prep);
          setMaking(null);
        }}
      />

      {typing ? null : (
        <>
          <View style={styles.group}>
            <Eyebrow>Drops, mist, rinse</Eyebrow>
            <View role="group" accessibilityLabel="Drops, mist, rinse" style={styles.chips}>
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
          <View style={styles.group}>
            <Eyebrow>Garnish</Eyebrow>
            <View role="group" accessibilityLabel="Garnish" style={styles.chips}>
              {garnishes.map((c) => (
                <WizardChip key={c.label} kind="checkbox" label={c.label} selected={has(c.name, c.unit)} onPress={() => toggle(c.name, c.unit, c.amount)} />
              ))}
              {garnishes.length < GARNISH_CHIPS.length ? <WizardChip label="More" kind="button" onPress={() => setAll(true)} /> : null}
            </View>
          </View>
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
