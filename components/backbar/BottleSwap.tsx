import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Caption, Field, IngredientThumb, TextLink, useDs } from '@/components/ds';
import { BottleOptions, useBottleOptions } from '@/components/screens/drink/BottleOptions';
import { Choice } from '@/components/screens/menus/MenuSheet';
import { fontFamilies, radius, space } from '@/constants/tokens';
import type { PourRow } from '@/lib/backBarSwap';

export type Bottle = { id: string; name: string };

/** Which bottle goes on the shelf (or into the drinks) instead: search, or the others of its kind. */
export function PickBottle({ barId, bottle, onPick }: { barId: string; bottle: Bottle; onPick: (picked: Bottle) => void }) {
  const [query, setQuery] = useState('');
  const options = useBottleOptions(bottle.id, barId, query);
  return (
    <>
      <Field label={`Search for what replaces ${bottle.name}`} hideLabel icon="magnifyingglass" value={query} onChangeText={setQuery} placeholder={bottle.name} autoCapitalize="none" autoCorrect={false} />
      <BottleOptions label={`What replaces ${bottle.name}`} barId={barId} options={options} pickedId={null} onPick={(o) => (o ? onPick(o) : undefined)} />
      {options.none ? <Body tone="muted">{`Nothing called “${query.trim()}”. Add it to the library first, then come back.`}</Body> : null}
    </>
  );
}

interface PourListProps {
  replaceWith: Bottle;
  rows: PourRow[];
  /** Unticked rows stay as they are. */
  unticked: Record<string, boolean>;
  onToggle: (id: string) => void;
  onChange: () => void;
  /** Off for roles without `edit_drinks`: the drinks are listed, not ticked. */
  canEditDrinks: boolean;
}

/** The swap: the bottle going in, then everything that pours the old one, ticked. */
export function PourList({ replaceWith, rows, unticked, onToggle, onChange, canEditDrinks }: PourListProps) {
  const ds = useDs();
  return (
    <>
      <View style={[styles.with, { backgroundColor: ds.c.raised }]}>
        <IngredientThumb id={replaceWith.id} name={replaceWith.name} size={36} />
        <View style={styles.flex}>
          <Caption tone="muted">With</Caption>
          <Body style={styles.strong}>
            {replaceWith.name}
          </Body>
        </View>
        <TextLink label="Change" tone="ink" onPress={onChange} accessibilityHint="Pick another bottle" />
      </View>
      {rows.length ? (
        <Caption tone="muted" role="heading">
          {`EVERYTHING THAT POURS IT · ${rows.length}`}
        </Caption>
      ) : (
        <Body tone="muted">No drinks or house-made ingredients pour it.</Body>
      )}
      {canEditDrinks ? (
        <View role="group" aria-label="Drinks and house-made ingredients to swap" style={styles.rows}>
          {rows.map((row) => (
            <Choice
              key={row.hit.drink.id}
              kind="checkbox"
              label={row.hit.drink.name}
              detail={row.detail}
              selected={!unticked[row.hit.drink.id]}
              onPress={() => onToggle(row.hit.drink.id)}
            />
          ))}
        </View>
      ) : rows.length ? (
        <>
          {rows.map((row) => (
            <View key={row.hit.drink.id}>
              <Body>{row.hit.drink.name}</Body>
              <Caption tone="muted">{row.detail}</Caption>
            </View>
          ))}
          <Caption tone="muted">Drink Creators and up can swap them. These keep pouring the old bottle until someone does.</Caption>
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  with: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.md, borderRadius: radius.control },
  flex: { flex: 1 },
  strong: { fontFamily: fontFamilies.bodySemiBold },
  rows: { gap: space.sm },
});
