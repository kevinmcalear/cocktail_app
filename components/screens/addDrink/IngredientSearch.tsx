import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Body, Caption, IngredientThumb, PressableScale, useDs } from '@/components/ds';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamilies, layout, radius, space, type } from '@/constants/tokens';
import { useIngredientUse } from '@/hooks/useIngredientUse';
import type { WizardPick } from '@/lib/drinkWizard';
import { closestIngredients, nearIngredient, sameIngredient, searchIngredients, type IngredientAlias } from '@/lib/ingredientNames';
import { guessKind, PREP_KINDS } from '@/lib/prepKinds';
import { looksMadeInHouse } from '@/lib/techniques/makeIt';

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
  /** Off: only existing ingredients can be picked (a kind of must exist). */
  allowNew?: boolean;
  /** Offers to make it in house, with its own recipe: a new name, or your own version of one that exists. */
  onMake?: (name: string) => void;
  /** "Just add the name" for a prep: its recipe is written later, and the save reminds you. */
  onLater?: (name: string) => void;
  /** A name that sounds made (an oil, a cordial) offers making it before any bottle. */
  makeFirst?: boolean;
  /** Under each found ingredient: "On your shelf" (these ids), else "In 14 drinks". Off by default (it asks the server). */
  captions?: boolean;
  shelf?: ReadonlySet<string>;
}

/**
 * Find an ingredient, or add a new one. A name that is already an
 * ingredient, by another spelling or alias, offers that one and not a copy;
 * a likely misspelling asks "Did you mean…?" first, and a name nothing
 * matches shows the closest ones. Making it in house is always offered
 * (your own version when the name exists). Return takes the top hit.
 */
export function IngredientSearch(props: IngredientSearchProps) {
  const { ingredients, aliases = [], coreIds, loading, onPick, label, autoFocus, onCancel, onTyping, allowNew = true, onMake, onLater, makeFirst, captions, shelf } = props;
  const ds = useDs();
  const [query, setQueryState] = useState('');
  const setQuery = (q: string) => {
    setQueryState(q);
    onTyping?.(!!q.trim());
  };
  const q = query.trim();
  const results = searchIngredients(query, ingredients, { aliases, coreIds });
  const exact = !!sameIngredient(query, ingredients, aliases) || results.some((r) => (r.name ?? '').trim().toLowerCase() === q.toLowerCase());
  const near = exact ? null : nearIngredient(query, ingredients, aliases);
  const closest = results.length || near || exact || loading ? [] : closestIngredients(query, ingredients, { coreIds });

  // Any new name can be made in house; one that sounds like a prep (a shrub, a cordial, a clarified juice), not a bought bottle, offers it first.
  const prepLike = looksMadeInHouse(query);
  const kind = PREP_KINDS.find((k) => k.id === guessKind(query) && k.id !== 'other')?.name.toLowerCase() ?? null;
  const done = () => setQuery('');
  const makeRow = onMake ? (
    <ResultRow
      label={`Make “${q}” in house`}
      sub={exact ? 'Your own version, with your recipe. We’ll start you off.' : 'Your own house prep. We’ll start you off.'}
      icon="make"
      onPress={() => {
        onMake(q);
        done();
      }}
    />
  ) : null;
  const later = !!onLater && prepLike;
  const newRow = (
    <ResultRow
      label="Just add the name"
      a11y={`Just add the name “${q}”`}
      sub={later ? 'Write the recipe later. We’ll remind you.' : 'Added as new when you save.'}
      icon="new"
      onPress={() => {
        if (later) onLater?.(q);
        else onPick({ id: null, name: q });
        done();
      }}
    />
  );

  const lead = makeFirst && prepLike && !exact && !loading;

  const pick = (p: WizardPick) => {
    onPick(p);
    done();
  };
  const found = (r: CatalogIngredient, text?: string) => (
    <ResultRow key={r.id} id={r.id} label={text ?? r.name ?? ''} caption={captions ? <UseCaption id={r.id} onShelf={!!shelf?.has(r.id)} /> : null} onPress={() => pick({ id: r.id, name: r.name ?? query })} />
  );

  return (
    <View style={styles.stack}>
      <View style={[styles.field, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
        <IconSymbol name={onCancel || !allowNew ? 'magnifyingglass' : 'plus'} size={18} color={ds.c.muted} />
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
            else if (allowNew && q && !loading) pick({ id: null, name: q });
          }}
          style={[styles.input, type.body, { fontFamily: fontFamilies.body, color: ds.c.ink }]}
        />
        {onCancel ? (
          <PressableScale onPress={onCancel} role="button" accessibilityLabel="Keep it as it was" style={styles.cancel}>
            <IconSymbol name="xmark" size={16} color={ds.c.muted} />
          </PressableScale>
        ) : null}
      </View>

      {q ? (
        <View role="list" style={[styles.results, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
          {closest.length ? (
            <Caption tone="muted" style={styles.label}>
              Nothing called that yet. Closest:
            </Caption>
          ) : null}
          {closest.map((r) => found(r))}
          {lead ? makeRow : null}
          {near && !results.includes(near) ? found(near, `Did you mean ${near.name}?`) : null}
          {results.map((r) => found(r))}
          {loading ? (
            <Body tone="muted" style={styles.loading}>
              Loading ingredients…
            </Body>
          ) : exact ? (
            makeRow
          ) : !allowNew ? null : (
            <>
              {makeRow && prepLike && !lead ? makeRow : null}
              {newRow}
              {makeRow && !prepLike ? makeRow : null}
            </>
          )}
        </View>
      ) : null}
      {q && exact && makeRow && !loading ? (
        <Caption tone="muted">{`Return takes the top one. Make is still here: ${kind ? `a ${kind}` : 'one'} of your own is saved as yours, next to the one you have.`}</Caption>
      ) : null}
    </View>
  );
}

/** "On your shelf", else how many drinks use it. */
function UseCaption({ id, onShelf }: { id: string; onShelf: boolean }) {
  const { data: n } = useIngredientUse(onShelf ? null : id);
  if (onShelf) return <Caption tone="muted">On your shelf</Caption>;
  return n ? <Caption tone="muted">{`In ${n} ${n === 1 ? 'drink' : 'drinks'}`}</Caption> : null;
}

/** A found ingredient with its drawing, or an action row (make it in house, add the name) with its tile. */
function ResultRow({ id, label, a11y, sub, caption, icon, onPress }: { id?: string; label: string; a11y?: string; sub?: string; caption?: ReactNode; icon?: 'make' | 'new'; onPress: () => void }) {
  const ds = useDs();
  return (
    <PressableScale role="button" onPress={onPress} accessibilityLabel={a11y ?? label} accessibilityHint={sub} style={[styles.result, { borderBottomColor: ds.c.line }]}>
      {icon ? (
        <View style={[styles.tile, { backgroundColor: icon === 'make' ? ds.accentFill.fill : ds.c.raised }]}>
          <IconSymbol name={icon === 'make' ? 'sparkles' : 'plus'} size={16} color={icon === 'make' ? ds.accentFill.text : ds.c.ink} />
        </View>
      ) : (
        <IngredientThumb id={id} name={label} size={36} />
      )}
      <View style={styles.flex}>
        <Body numberOfLines={1}>{label}</Body>
        {sub ? <Caption tone="muted">{sub}</Caption> : caption}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  field: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, borderRadius: radius.pill, borderWidth: 1, paddingLeft: space.lg, paddingRight: space.xs },
  input: { flex: 1, minHeight: layout.minTapTarget },
  cancel: { width: layout.minTapTarget, height: layout.minTapTarget, alignItems: 'center', justifyContent: 'center' },
  results: { borderRadius: radius.control, borderWidth: 1, overflow: 'hidden' },
  label: { paddingHorizontal: space.md, paddingTop: space.md },
  result: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.minTapTarget + 4, paddingHorizontal: space.md, paddingVertical: space.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  tile: { width: 36, height: 36, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  loading: { padding: space.md },
});
