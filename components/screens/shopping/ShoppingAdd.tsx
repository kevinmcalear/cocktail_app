import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, DsText, Field, IngredientThumb, useDs } from '@/components/ds';
import { space } from '@/constants/tokens';
import { useBarSearch, usePantryItems } from '@/hooks/useHomeBar';
import type { ShoppingAdd as Add } from '@/hooks/useShoppingList';
import type { BarSection } from '@/lib/barSections';
import { juiceFruit, shopFor } from '@/lib/shoppingList';

const SHOWN = 5;

/**
 * Add by hand (shopping In 4): the same search as Add bottles. A thing from
 * the catalog knows its shop and goes on your shelf when you tick it; one on
 * your shelf already can be marked running low; a juice adds its fruit and a
 * house-made thing what it's made from; typed words just get crossed off.
 */
export function ShoppingAdd({ onShelf, onAdd, onAddMadeFrom }: { onShelf: ReadonlySet<string>; onAdd: (add: Add) => void; onAddMadeFrom: (item: { id: string; name: string }) => void }) {
  const ds = useDs();
  const [text, setText] = useState('');
  const query = text.trim();
  const found = useBarSearch(query).data ?? [];
  const pantry = usePantryItems().data ?? [];
  const add = (a: Add) => {
    onAdd(a);
    setText('');
  };
  // What a result's row says and does: a bottle you have can run low; a juice adds its fruit and a house-made thing what it's made from (d54).
  const addRow = (f: { id: string; name: string; section: BarSection }) => {
    const fruit = juiceFruit(f.name);
    const fruitId = fruit ? pantry.find((p) => p.name.toLowerCase() === fruit.name.toLowerCase())?.id : undefined;
    if (fruit && fruitId) {
      const low = onShelf.has(fruitId);
      return {
        note: `Squeezed from ${fruit.label.toLowerCase()}, so ${low ? 'it can mark yours running low' : `adds ${fruit.label}`}`,
        label: low ? 'Running low' : 'Add',
        say: low ? `Mark ${fruit.label} running low` : `Add ${fruit.label} for ${f.name}`,
        onPress: () => add({ itemId: fruitId, name: fruit.label, source: low ? 'running_low' : 'hand', forItemId: low ? null : f.id }),
      };
    }
    if (onShelf.has(f.id)) return { note: 'On your shelf', label: 'Running low', say: `Mark ${f.name} running low`, onPress: () => add({ itemId: f.id, name: f.name, source: 'running_low' }) };
    if (f.section === 'preps') {
      return {
        note: 'House-made: adds what you need to make it',
        label: 'Add',
        say: `Add what ${f.name} needs`,
        onPress: () => {
          onAddMadeFrom(f);
          setText('');
        },
      };
    }
    return { note: shopFor(f.section), label: 'Add', say: `Add ${f.name}`, onPress: () => add({ itemId: f.id, name: f.name, source: 'hand' }) };
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
        onSubmitEditing={() => (query ? add({ name: query, source: 'hand' }) : undefined)}
      />
      {query ? (
        <View style={[styles.results, { borderColor: ds.c.line }]}>
          {found.slice(0, SHOWN).map((f) => {
            const r = addRow(f);
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
                <Button label={r.label} size="sm" variant="secondary" accessibilityLabel={r.say} onPress={r.onPress} />
              </View>
            );
          })}
          <View style={styles.result}>
            <View style={styles.text}>
              <DsText variant="body" numberOfLines={1}>{`Add “${query}” just as you typed it`}</DsText>
            </View>
            <Button label="Add" size="sm" variant="secondary" accessibilityLabel={`Add ${query} as typed`} onPress={() => add({ name: query, source: 'hand' })} />
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
