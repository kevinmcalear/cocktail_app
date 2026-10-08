import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { COMMON_INGREDIENTS, guessUnit, newLine, pickByName, type StepProps, type WizardLine, type WizardPick } from '@/lib/drinkWizard';
import { nearIngredient, sameIngredient, searchIngredients, type IngredientAlias } from '@/lib/ingredientNames';
import { getPreferredUnit } from '@/store/useSettingsStore';

import { BalanceCard, GoesWith } from './GoesWith';
import { LineRow } from './LineRow';
import { WizardChip } from './WizardChrome';

// The generated view types call `images` a list; it's one row per link.
type Ingredient = { id: string; name: string | null; bar_id?: string | null; hide_from_search?: boolean | null; generic_id?: string | null; item_images?: unknown };

/** How many quick adds show under the field. */
const QUICK = 8;

/**
 * The spec so far, each line with a stepper; a field to find an ingredient
 * (or add a new one); and quick adds for the common ones. A name that is
 * already an ingredient, by another spelling or alias, offers that one and
 * not a copy; a likely misspelling asks "Did you mean…?" first. `loading`
 * holds off offering a new one until the list is in, so a known bottle isn't
 * added twice.
 */
export function IngredientsStep({
  draft,
  set,
  ingredients,
  loading,
  aliases = [],
  coreIds,
}: StepProps & { ingredients: readonly Ingredient[]; loading?: boolean; aliases?: readonly IngredientAlias[]; coreIds?: ReadonlySet<string> }) {
  const ds = useDs();
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const results = searchIngredients(query, ingredients, { aliases, coreIds });
  const exact = !!sameIngredient(query, ingredients, aliases) || results.some((r) => (r.name ?? '').trim().toLowerCase() === query.trim().toLowerCase());
  const near = exact ? null : nearIngredient(query, ingredients, aliases);

  const add = (pick: WizardPick) => {
    set({ lines: [...draft.lines, newLine(pick, guessUnit(pick.name, getPreferredUnit()))] });
    setQuery('');
  };
  const change = (key: string, c: Partial<WizardLine>) => set({ lines: draft.lines.map((l) => (l.key === key ? { ...l, ...c } : l)) });
  const has = (name: string) => draft.lines.some((l) => l.name.trim().toLowerCase() === name.toLowerCase());
  const quick = COMMON_INGREDIENTS.filter((n) => !has(n)).slice(0, QUICK);

  return (
    <View style={styles.stack}>
      {draft.lines.length ? (
        <View>
          {draft.lines.map((l) => (
            <LineRow
              key={l.key}
              line={l}
              open={l.key === openKey}
              onToggle={() => setOpenKey(openKey === l.key ? null : l.key)}
              onChange={(c) => change(l.key, c)}
              onRemove={() => set({ lines: draft.lines.filter((x) => x.key !== l.key) })}
            />
          ))}
        </View>
      ) : null}

      <View style={[styles.field, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
        <IconSymbol name="plus" size={18} color={ds.c.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Add an ingredient"
          placeholderTextColor={ds.c.muted}
          aria-label="Add an ingredient"
          autoCorrect={false}
          returnKeyType="done"
          maxLength={80}
          onSubmitEditing={() => {
            if (results[0]) add({ id: results[0].id, name: results[0].name ?? query });
            else if (query.trim() && !loading) add({ id: null, name: query.trim() });
          }}
          style={[styles.input, type.body, { fontFamily: fontFamilies.body, color: ds.c.ink }]}
        />
      </View>

      {query.trim() ? (
        <View role="list" style={[styles.results, { borderColor: ds.c.line }]}>
          {near && !results.includes(near) ? (
            <ResultRow id={near.id} label={`Did you mean ${near.name}?`} onPress={() => add({ id: near.id, name: near.name ?? query })} />
          ) : null}
          {results.map((r) => (
            <ResultRow key={r.id} id={r.id} label={r.name ?? ''} onPress={() => add({ id: r.id, name: r.name ?? query })} />
          ))}
          {loading ? (
            <Body tone="muted" style={styles.loading}>Loading ingredients…</Body>
          ) : exact ? null : (
            <ResultRow label={`Add “${query.trim()}” as new`} isNew onPress={() => add({ id: null, name: query.trim() })} />
          )}
        </View>
      ) : (
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
      )}
      <BalanceCard lines={draft.lines} ingredients={ingredients} />
    </View>
  );
}

/** A found ingredient, with its drawing; `isNew` is the plain "add as new" row. */
function ResultRow({ id, label, isNew, onPress }: { id?: string; label: string; isNew?: boolean; onPress: () => void }) {
  const ds = useDs();
  const found = !isNew;
  return (
    <PressableScale role="button" onPress={onPress} accessibilityLabel={label} style={[styles.result, found && styles.found, { borderBottomColor: ds.c.line }]}>
      {found ? <IngredientThumb id={id} name={label} size={36} /> : null}
      <Body numberOfLines={1} style={styles.flex}>{label}</Body>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  field: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: space.lg },
  input: { flex: 1, minHeight: layout.minTapTarget },
  results: { borderRadius: radius.control, borderWidth: 1, overflow: 'hidden' },
  result: { minHeight: layout.minTapTarget + 4, justifyContent: 'center', paddingHorizontal: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  found: { flexDirection: 'row', alignItems: 'center', gap: space.md, justifyContent: 'flex-start', paddingVertical: space.xs },
  flex: { flex: 1 },
  loading: { padding: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
