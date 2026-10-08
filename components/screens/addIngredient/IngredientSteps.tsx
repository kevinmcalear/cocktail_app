import { Alert, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { layout, radius, space } from '@/constants/tokens';
import { useStartFromClassic } from '@/hooks/useStartFromClassic';
import { EMPTY_DRAFT } from '@/lib/drinkWizard';
import type { IngredientAlias } from '@/lib/ingredientNames';
import { guessRole, kindGuesses, ROLE_COPY, suggestedAbv, type IngredientDraft, type IngredientRole } from '@/lib/ingredientWizard';

import { IngredientSearch, type CatalogIngredient } from '../addDrink/IngredientSearch';
import { IngredientsStep } from '../addDrink/IngredientsStep';
import { Eyebrow, WizardChip } from '../addDrink/WizardChrome';

export interface IngredientStepProps {
  draft: IngredientDraft;
  set: (change: Partial<IngredientDraft>) => void;
  onDone?: () => void;
}

interface CatalogProps {
  ingredients: readonly CatalogIngredient[];
  aliases: readonly IngredientAlias[];
  core: readonly CatalogIngredient[];
  coreIds: ReadonlySet<string>;
  loading: boolean;
}

/** A bottle, made in house, or something else: it decides the steps after. Our guess from the name is marked. */
export function WhatStep({ draft, set }: IngredientStepProps) {
  const ds = useDs();
  const guess = draft.role ? null : guessRole(draft.name, draft.maker);
  return (
    <View role="radiogroup" accessibilityLabel="What it is" style={styles.stack}>
      {(Object.keys(ROLE_COPY) as IngredientRole[]).map((role) => {
        const on = draft.role === role;
        return (
          <PressableScale
            key={role}
            role="radio"
            aria-checked={on}
            accessibilityLabel={`${ROLE_COPY[role].label}${guess === role ? ', suggested' : ''}`}
            onPress={() => set({ role: on ? null : role })}
            style={[styles.option, { borderColor: on || guess === role ? ds.accentFill.fill : ds.c.lineStrong, backgroundColor: on ? ds.accentFill.fill : 'transparent', borderWidth: guess === role && !on ? 2 : 1 }]}
          >
            <View style={styles.flex}>
              <Body color={on ? ds.accentFill.text : ds.c.ink}>{ROLE_COPY[role].label}</Body>
              <Caption color={on ? ds.accentFill.text : ds.c.muted}>{ROLE_COPY[role].hint}</Caption>
            </View>
            {guess === role ? <IconSymbol name="sparkles" size={16} color={ds.c.ink} /> : on ? <IconSymbol name="checkmark" size={16} color={ds.accentFill.text} /> : null}
          </PressableScale>
        );
      })}
    </View>
  );
}

/** What it's a kind of: the likely ones from its name first, or find any. */
export function KindStep({ draft, set, ingredients, aliases, core, coreIds, loading }: IngredientStepProps & CatalogProps) {
  const guesses = kindGuesses(draft.name, core);
  return (
    <View style={styles.stack}>
      {draft.generic ? (
        <View role="radiogroup" accessibilityLabel="Kind of" style={styles.chips}>
          <WizardChip label={draft.generic.name} selected onPress={() => set({ generic: null })} />
        </View>
      ) : guesses.length ? (
        <View style={styles.group}>
          <Eyebrow>Probably</Eyebrow>
          <View role="radiogroup" accessibilityLabel="Kind of" style={styles.chips}>
            {guesses.map((g, i) => (
              <WizardChip key={g.id} label={g.name ?? ''} suggested={i === 0} onPress={() => set({ generic: { id: g.id, name: g.name ?? '' } })} />
            ))}
          </View>
        </View>
      ) : null}
      <IngredientSearch
        ingredients={ingredients}
        aliases={aliases}
        coreIds={coreIds}
        loading={loading}
        allowNew={false}
        label={draft.generic ? 'Something else' : 'Find what it’s a kind of'}
        onPick={(p) => p.id && set({ generic: { id: p.id, name: p.name } })}
      />
      <Caption tone="muted">“Tanqueray” is a kind of Gin; “Rich Demerara Syrup” a kind of Demerara Syrup.</Caption>
    </View>
  );
}

export function MakerStep({ draft, set, onDone }: IngredientStepProps) {
  return <Field label="Maker" placeholder="e.g. Campari, Buffalo Trace" value={draft.maker} onChangeText={(maker) => set({ maker })} autoFocus={!draft.maker} returnKeyType="next" onSubmitEditing={onDone} maxLength={80} />;
}

/** A house prep's recipe, with the same lines as a drink's spec; it can start from its kind's own recipe. */
export function RecipeStep({ draft, set, ingredients, aliases, coreIds, loading }: IngredientStepProps & CatalogProps) {
  const start = useStartFromClassic();
  const kind = draft.generic;
  const kindId = kind?.id;
  return (
    <View style={styles.stack}>
      {kind && kindId && !draft.lines.length ? (
        <Button
          label={start.isPending ? 'Loading…' : `Start from ${kind.name}’s recipe`}
          icon="sparkles"
          variant="secondary"
          disabled={start.isPending}
          style={styles.start}
          onPress={() =>
            start.mutate(kindId, {
              onSuccess: ({ lines = [], garnishes = [] }) => {
                const all = [...lines, ...garnishes];
                if (all.length) set({ lines: all });
                else Alert.alert('No recipe to start from', `${kind.name} has no recipe yet.`);
              },
              onError: (e) => Alert.alert('Couldn’t load the recipe', e.message),
            })
          }
        />
      ) : null}
      <IngredientsStep
        draft={{ ...EMPTY_DRAFT, lines: draft.lines }}
        set={(c) => c.lines && set({ lines: c.lines })}
        ingredients={ingredients}
        aliases={aliases}
        coreIds={coreIds}
        loading={loading}
        forDrink={false}
      />
    </View>
  );
}

/** ABV, with the strength the taste rules give its kind offered first. */
export function StrengthStep({ draft, set, onDone }: IngredientStepProps) {
  const usual = suggestedAbv(draft.name, draft.generic?.name ?? null);
  return (
    <View style={styles.stack}>
      <Field label="ABV (%)" placeholder={usual ? String(usual) : 'e.g. 40'} value={draft.abv} onChangeText={(abv) => set({ abv: abv.replace(/[^0-9.,]/g, '') })} keyboardType="decimal-pad" returnKeyType="next" onSubmitEditing={onDone} maxLength={5} />
      {usual && !draft.abv ? (
        <View role="group" accessibilityLabel="Usual strength" style={styles.chips}>
          <WizardChip label={`${usual}%`} kind="button" suggested onPress={() => set({ abv: String(usual) })} />
        </View>
      ) : null}
      {draft.role === 'prep' ? <Caption tone="muted">For an infusion or a batch with spirit in it. Leave it empty for a syrup.</Caption> : null}
    </View>
  );
}

export function NotesStep({ draft, set }: IngredientStepProps) {
  return <Field label="Notes" hint="How it’s used, how long it keeps, anything the next person should know." value={draft.description} onChangeText={(description) => set({ description })} minLines={3} maxLength={1000} />;
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + 16, padding: space.lg, borderRadius: radius.control },
  flex: { flex: 1, gap: 2 },
  start: { alignSelf: 'flex-start' },
});
