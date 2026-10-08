import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import type { WizardPick } from '@/lib/drinkWizard';
import { nearIngredient, sameIngredient, searchIngredients, type IngredientAlias } from '@/lib/ingredientNames';

// The generated view types call `images` a list; it's one row per link.
export type CatalogIngredient = { id: string; name: string | null; bar_id?: string | null; hide_from_search?: boolean | null; generic_id?: string | null; item_images?: unknown };

export interface IngredientSearchProps {
  ingredients: readonly CatalogIngredient[];
  aliases?: readonly IngredientAlias[];
  coreIds?: ReadonlySet<string>;
  /** Holds off offering a new one until the list is in, so a known bottle isn't added twice. */
  loading?: boolean;
  onPick: (pick: WizardPick) => void;
  label: string;
  autoFocus?: boolean;
  /** Shows a close button: leaving a swap without changing anything. */
  onCancel?: () => void;
  /** Called with whether something is typed, so the step can hide its suggestions meanwhile. */
  onTyping?: (typing: boolean) => void;
}

/**
 * Find an ingredient, or add a new one. A name that is already an
 * ingredient, by another spelling or alias, offers that one and not a copy;
 * a likely misspelling asks "Did you mean…?" first. Return takes the top hit.
 */
export function IngredientSearch({ ingredients, aliases = [], coreIds, loading, onPick, label, autoFocus, onCancel, onTyping }: IngredientSearchProps) {
  const ds = useDs();
  const [query, setQueryState] = useState('');
  const setQuery = (q: string) => {
    setQueryState(q);
    onTyping?.(!!q.trim());
  };
  const results = searchIngredients(query, ingredients, { aliases, coreIds });
  const exact = !!sameIngredient(query, ingredients, aliases) || results.some((r) => (r.name ?? '').trim().toLowerCase() === query.trim().toLowerCase());
  const near = exact ? null : nearIngredient(query, ingredients, aliases);

  const pick = (p: WizardPick) => {
    onPick(p);
    setQuery('');
  };

  return (
    <View style={styles.stack}>
      <View style={[styles.field, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
        <IconSymbol name={onCancel ? 'magnifyingglass' : 'plus'} size={18} color={ds.c.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={label}
          placeholderTextColor={ds.c.muted}
          aria-label={label}
          autoFocus={autoFocus}
          autoCorrect={false}
          returnKeyType="done"
          maxLength={80}
          onSubmitEditing={() => {
            if (results[0]) pick({ id: results[0].id, name: results[0].name ?? query });
            else if (query.trim() && !loading) pick({ id: null, name: query.trim() });
          }}
          style={[styles.input, type.body, { fontFamily: fontFamilies.body, color: ds.c.ink }]}
        />
        {onCancel ? (
          <PressableScale onPress={onCancel} role="button" accessibilityLabel="Keep it as it was" style={styles.cancel}>
            <IconSymbol name="xmark" size={16} color={ds.c.muted} />
          </PressableScale>
        ) : null}
      </View>

      {query.trim() ? (
        <View role="list" style={[styles.results, { borderColor: ds.c.line }]}>
          {near && !results.includes(near) ? (
            <ResultRow id={near.id} label={`Did you mean ${near.name}?`} onPress={() => pick({ id: near.id, name: near.name ?? query })} />
          ) : null}
          {results.map((r) => (
            <ResultRow key={r.id} id={r.id} label={r.name ?? ''} onPress={() => pick({ id: r.id, name: r.name ?? query })} />
          ))}
          {loading ? (
            <Body tone="muted" style={styles.loading}>
              Loading ingredients…
            </Body>
          ) : exact ? null : (
            <ResultRow label={`Add “${query.trim()}” as new`} isNew onPress={() => pick({ id: null, name: query.trim() })} />
          )}
        </View>
      ) : null}
    </View>
  );
}

/** A found ingredient, with its drawing; `isNew` is the plain "add as new" row. */
function ResultRow({ id, label, isNew, onPress }: { id?: string; label: string; isNew?: boolean; onPress: () => void }) {
  const ds = useDs();
  const found = !isNew;
  return (
    <PressableScale role="button" onPress={onPress} accessibilityLabel={label} style={[styles.result, found && styles.found, { borderBottomColor: ds.c.line }]}>
      {found ? <IngredientThumb id={id} name={label} size={36} /> : <IconSymbol name="plus" size={16} color={ds.c.muted} />}
      <Body numberOfLines={1} style={styles.flex}>
        {label}
      </Body>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  field: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, borderRadius: radius.pill, borderWidth: 1, paddingLeft: space.lg, paddingRight: space.xs },
  input: { flex: 1, minHeight: layout.minTapTarget },
  cancel: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  results: { borderRadius: radius.control, borderWidth: 1, overflow: 'hidden' },
  result: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + 4, paddingHorizontal: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  found: { paddingVertical: space.xs },
  flex: { flex: 1 },
  loading: { padding: space.md },
});
