import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, Field, IngredientThumb, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useBarSearch, usePantryItems, usePrepDetails } from '@/hooks/useHomeBar';
import { useKindsOf } from '@/hooks/useShelfCheck';
import type { ShoppingAdd as Add } from '@/hooks/useShoppingList';
import { handRow, staplesFrom } from '@/lib/shoppingList';

const SHOWN = 5;

/**
 * Add by hand (shopping In 4): the same search as Add bottles. A thing from
 * the catalog knows its shop and goes on your shelf when you tick it; one on
 * your shelf already can be marked running low; typed words just get crossed off.
 * A house-made thing adds what it's made from, each for it ("For Lime cordial"):
 * lemon juice adds Lemons, or marks yours running low (handRow).
 */
export function ShoppingAdd({ onShelf, shelfKinds, onAdd }: { onShelf: ReadonlySet<string>; shelfKinds: ReadonlySet<string>; onAdd: (adds: Add[]) => void }) {
  const ds = useDs();
  const [text, setText] = useState('');
  const query = text.trim();
  const found = (useBarSearch(query).data ?? []).slice(0, SHOWN);
  // Recipes two deep, and what each thing in them is a kind of: a cordial's lime juice and peel come from limes.
  const madeQuery = usePrepDetails(found.flatMap((f) => (f.section === 'preps' && !onShelf.has(f.id) ? [f.id] : [])));
  const made = madeQuery.data ?? {};
  const deeperQuery = usePrepDetails(Object.values(made).flatMap((d) => d.lines.map((l) => l.id)));
  const deeper = deeperQuery.data ?? {};
  const recipes = { ...deeper, ...made };
  const lines = Object.values(recipes).flatMap((d) => d.lines);
  const things = [...found, ...lines];
  const kindsQuery = useKindsOf(things.map((t) => t.id), true);
  const kinds = kindsQuery.data ?? {};
  const staples = staplesFrom(things, kinds, usePantryItems().data ?? []);
  // A recipe's "Gin" is covered by any gin on the shelf.
  const have = new Set([...onShelf, ...lines.flatMap((l) => (l.generic && shelfKinds.has(l.name.toLowerCase()) ? [l.id] : []))]);
  // A tap while a row's recipe or kinds are still on their way would list the thing itself. Only while a fetch runs:
  // a failed lookup leaves it a plain row.
  const pending = (f: { id: string; section: string }) => {
    const own = made[f.id]?.lines ?? [];
    return (
      (kindsQuery.isFetching && [f, ...own].some((t) => !(t.id in kinds))) ||
      (f.section === 'preps' && ((madeQuery.isFetching && !made[f.id]) || (deeperQuery.isFetching && own.some((l) => !(l.id in deeper)))))
    );
  };
  const add = (adds: Add[]) => {
    onAdd(adds);
    setText('');
  };
  return (
    <View style={styles.wrap}>
      <Field
        label="Add something to the list"
        hideLabel
        icon="plus"
        placeholder="Add a bottle, fruit, anything"
        value={text}
        onChangeText={setText}
        returnKeyType="done"
        onSubmitEditing={() => (query ? add([{ name: query, source: 'hand' }]) : undefined)}
      />
      {query ? (
        <View style={[styles.results, { borderColor: ds.c.line }]}>
          {found.map((f) => {
            const r = handRow(f, { onShelf, have, recipes, staples });
            const loading = !onShelf.has(f.id) && pending(f);
            return (
              <View key={f.id} style={[styles.result, { borderBottomColor: ds.c.line }]}>
                <IngredientThumb id={f.id} name={f.name} size={36} />
                <View style={styles.text}>
                  <DsText variant="body" numberOfLines={1}>
                    {f.name}
                  </DsText>
                  <Caption tone="muted" numberOfLines={2}>
                    {r.note}
                  </Caption>
                </View>
                <Button label={r.label} size="sm" variant="secondary" disabled={loading} accessibilityLabel={r.say} onPress={() => add(r.adds)} />
              </View>
            );
          })}
          <View style={styles.result}>
            <View style={styles.text}>
              <DsText variant="body" numberOfLines={1}>{`Add “${query}” just as you typed it`}</DsText>
            </View>
            <Button label="Add" size="sm" variant="secondary" accessibilityLabel={`Add ${query} as typed`} onPress={() => add([{ name: query, source: 'hand' }])} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  results: { borderTopWidth: StyleSheet.hairlineWidth },
  result: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { flex: 1, minWidth: 0 },
});
