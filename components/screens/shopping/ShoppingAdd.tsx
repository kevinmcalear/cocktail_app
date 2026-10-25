import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, Field, IngredientThumb, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useBarSearch, usePrepDetails } from '@/hooks/useHomeBar';
import type { ShoppingAdd as Add } from '@/hooks/useShoppingList';
import { madeFrom, madeFromLine, shopFor } from '@/lib/shoppingList';

const SHOWN = 5;

/**
 * Add by hand (shopping In 4): the same search as Add bottles. A thing from
 * the catalog knows its shop and goes on your shelf when you tick it; one on
 * your shelf already can be marked running low; typed words just get crossed off.
 * A house-made thing adds what it's made from, each for it ("For Lime cordial"):
 * lemon juice adds Lemons.
 */
export function ShoppingAdd({ onShelf, onAdd }: { onShelf: ReadonlySet<string>; onAdd: (adds: Add[]) => void }) {
  const ds = useDs();
  const [text, setText] = useState('');
  const query = text.trim();
  const found = (useBarSearch(query).data ?? []).slice(0, SHOWN);
  // Two deep: a cordial's lime juice is made from limes.
  const made = usePrepDetails(found.flatMap((f) => (f.section === 'preps' && !onShelf.has(f.id) ? [f.id] : []))).data ?? {};
  const deeper = usePrepDetails(Object.values(made).flatMap((d) => d.lines.map((l) => l.id))).data ?? {};
  const recipes = { ...deeper, ...made };
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
            const have = onShelf.has(f.id);
            const parts = !have && made[f.id]?.lines.length ? madeFrom(f.id, recipes, onShelf) : null;
            const adds: Add[] = parts?.length ? parts.map((p) => ({ itemId: p.id, name: p.name, source: 'hand', forItemId: f.id })) : [{ itemId: f.id, name: f.name, source: have ? 'running_low' : 'hand' }];
            return (
              <View key={f.id} style={[styles.result, { borderBottomColor: ds.c.line }]}>
                <IngredientThumb id={f.id} name={f.name} size={36} />
                <View style={styles.text}>
                  <DsText variant="body" numberOfLines={1}>
                    {f.name}
                  </DsText>
                  <Caption tone="muted" numberOfLines={2}>
                    {have ? 'On your shelf' : parts ? madeFromLine(f.name, parts) : shopFor(f.section)}
                  </Caption>
                </View>
                <Button
                  label={have ? 'Running low' : 'Add'}
                  size="sm"
                  variant="secondary"
                  accessibilityLabel={have ? `Mark ${f.name} running low` : parts?.length ? `Add ${parts.map((p) => p.name).join(' and ')} for ${f.name}` : `Add ${f.name}`}
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
