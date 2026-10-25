import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, Field, IngredientThumb, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useBarSearch, usePantryItems, usePrepDetails } from '@/hooks/useHomeBar';
import { useKindsOf } from '@/hooks/useShelfCheck';
import type { ShoppingAdd as Add } from '@/hooks/useShoppingList';
import { madeFrom, madeFromLine, shopFor, staplesFrom } from '@/lib/shoppingList';

const SHOWN = 5;

/**
 * Add by hand (shopping In 4): the same search as Add bottles. A thing from
 * the catalog knows its shop and goes on your shelf when you tick it; one on
 * your shelf already can be marked running low; typed words just get crossed off.
 * A house-made thing adds what it's made from, each for it ("For Lime cordial"):
 * lemon juice adds Lemons.
 */
export function ShoppingAdd({ onShelf, shelfKinds, onAdd }: { onShelf: ReadonlySet<string>; shelfKinds: ReadonlySet<string>; onAdd: (adds: Add[]) => void }) {
  const ds = useDs();
  const [text, setText] = useState('');
  const query = text.trim();
  const found = (useBarSearch(query).data ?? []).slice(0, SHOWN);
  // Recipes two deep, and what each thing in them is a kind of: a cordial's lime juice and peel come from limes.
  const made = usePrepDetails(found.flatMap((f) => (f.section === 'preps' && !onShelf.has(f.id) ? [f.id] : []))).data ?? {};
  const deeper = usePrepDetails(Object.values(made).flatMap((d) => d.lines.map((l) => l.id))).data ?? {};
  const recipes = { ...deeper, ...made };
  const lines = Object.values(recipes).flatMap((d) => d.lines);
  const things = [...found, ...lines];
  const kinds = useKindsOf(things.map((t) => t.id)).data ?? {};
  const staples = staplesFrom(things, kinds, usePantryItems().data ?? []);
  // A recipe's "Gin" is covered by any gin on the shelf.
  const have = new Set([...onShelf, ...lines.flatMap((l) => (l.generic && shelfKinds.has(l.name.toLowerCase()) ? [l.id] : []))]);
  // What it's made from is known: its kind, and for a house-made thing its recipe and its parts' kinds.
  const known = (f: { id: string; section: string }) => f.id in kinds && (f.section !== 'preps' || (!!made[f.id] && made[f.id].lines.every((l) => l.id in recipes && l.id in kinds)));
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
            const mine = onShelf.has(f.id);
            const waiting = !mine && !known(f);
            const from = !mine && (staples[f.id] || made[f.id]?.lines.length) ? madeFrom(f.id, recipes, have, staples) : null;
            // Everything it's made from is on the shelf: then it's listed as itself.
            const parts = from?.length ? from : null;
            const adds: Add[] = parts?.length ? parts.map((p) => ({ itemId: p.id, name: p.name, source: 'hand', forItemId: f.id })) : [{ itemId: f.id, name: f.name, source: mine ? 'running_low' : 'hand' }];
            return (
              <View key={f.id} style={[styles.result, { borderBottomColor: ds.c.line }]}>
                <IngredientThumb id={f.id} name={f.name} size={36} />
                <View style={styles.text}>
                  <DsText variant="body" numberOfLines={1}>
                    {f.name}
                  </DsText>
                  <Caption tone="muted" numberOfLines={2}>
                    {mine ? 'On your shelf' : parts ? madeFromLine(f.name, parts, !!staples[f.id]) : shopFor(f.section)}
                  </Caption>
                </View>
                <Button
                  label={mine ? 'Running low' : 'Add'}
                  disabled={waiting}
                  size="sm"
                  variant="secondary"
                  accessibilityLabel={mine ? `Mark ${f.name} running low` : parts?.length ? `Add ${parts.map((p) => p.name).join(' and ')} for ${f.name}` : `Add ${f.name}`}
                  onPress={() => add(adds)}
                />
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
