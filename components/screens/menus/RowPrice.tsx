import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Caption, Field, PressableScale, Spec, useDs } from '@/components/ds';
import { layout, radius, space } from '@/constants/tokens';
import { formatPrice } from '@/lib/menus';
import type { MenuDrink } from '@/types/menus';

/** What a typed price looks like, and that it's the drink's own. */
function priceHint(alsoOn?: string) {
  return `As the menu prints it: 22, 22.50 or MP.${alsoOn ? ` Also on ${alsoOn}: it changes there too.` : ''}`;
}

/**
 * A builder row's price on a phone (venue-menus-prices, step 2): the price as
 * typed, or Add price, to tap. The edit opens under the row (PriceEditor).
 */
export function PriceButton({ drink, open, onPress }: { drink: MenuDrink; open: boolean; onPress: () => void }) {
  const ds = useDs();
  const price = formatPrice(drink.price);
  return (
    <PressableScale
      accessibilityLabel={price ? `${drink.name}: price ${price}. Change it` : `Add a price for ${drink.name}`}
      aria-expanded={open}
      onPress={onPress}
      style={price ? styles.price : [styles.add, { borderColor: ds.c.lineStrong }]}
    >
      {price ? <Spec tone={open ? 'accent' : 'ink'}>{price}</Spec> : <Caption tone="muted">Add price</Caption>}
    </PressableScale>
  );
}

/** The phone's edit, under the row: the price as typed, Clear and Done. */
export function PriceEditor({ drink, alsoOn, onPrice, onClose }: { drink: MenuDrink; alsoOn?: string; onPrice: (price: string | null) => void; onClose: () => void }) {
  const ds = useDs();
  const [draft, setDraft] = useState(drink.price ?? '');
  const done = (price: string | null) => {
    onPrice(price);
    onClose();
  };
  return (
    <View style={[styles.editor, { backgroundColor: ds.c.raised, borderColor: ds.c.lineStrong }]}>
      <Field label={`${drink.name}’s price`} value={draft} onChangeText={setDraft} placeholder="12.00 or MP" hint={priceHint(alsoOn)} autoFocus onSubmitEditing={() => done(draft)} returnKeyType="done" />
      <View style={styles.actions}>
        <Button label="Clear" variant="secondary" size="md" onPress={() => done(null)} />
        <Button label="Done" size="md" onPress={() => done(draft)} />
      </View>
    </View>
  );
}

/**
 * A builder row's price on desktop: a field in every row, so a whole menu can
 * be priced in one pass with Tab. It takes the price when you leave it.
 */
export function PriceField({ drink, onPrice }: { drink: MenuDrink; onPrice: (price: string | null) => void }) {
  const [draft, setDraft] = useState(drink.price ?? '');
  const commit = () => {
    if ((formatPrice(draft) ?? null) !== (formatPrice(drink.price) ?? null)) onPrice(draft);
  };
  return (
    <View style={styles.field}>
      <Field label={`${drink.name}’s price`} hideLabel value={draft} onChangeText={setDraft} placeholder="Price" onBlur={commit} onSubmitEditing={commit} textAlign="right" />
    </View>
  );
}

const styles = StyleSheet.create({
  price: { minWidth: layout.minTapTarget, minHeight: layout.minTapTarget, alignItems: 'flex-end', justifyContent: 'center' },
  add: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  editor: { gap: space.sm, padding: space.md, borderRadius: radius.card, borderWidth: 1, marginBottom: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
  field: { width: 120 },
});
