import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Field, useDs } from '@/components/ds';
import { useSuggestedPrice } from '@/hooks/useSuggestedPrice';
import { radius, space } from '@/constants/tokens';
import { formatPrice } from '@/lib/menus';
import type { MenuDrink } from '@/types/menus';

/** What a builder row needs to change prices: the drink's own, and this menu's. */
export interface RowPricing {
  /** This menu's name: "On Winter menu only". */
  menuName: string;
  barId: string | null;
  onPrice: (price: string | null) => void;
  onMenuPrice: (price: string | null) => void;
}

/**
 * A row's price edit, under the row: the drink's price, a suggested one when it
 * has a cost and none (step 6), and this menu's own price (step 5). Done
 * saves both; Clear empties this menu's price when it has one, else the
 * drink's.
 */
export function PriceEditor({ drink, alsoOn, pricing, onClose }: { drink: MenuDrink; alsoOn?: string; pricing: RowPricing; onClose: () => void }) {
  const ds = useDs();
  const [draft, setDraft] = useState(drink.price ?? '');
  const [menuDraft, setMenuDraft] = useState(drink.menuPrice ?? '');
  const suggested = useSuggestedPrice(drink.id, pricing.barId, drink.kind === 'cocktail' && !draft.trim());
  const done = (price: string | null, menuPrice: string | null) => {
    pricing.onPrice(price);
    pricing.onMenuPrice(menuPrice);
    onClose();
  };
  return (
    <View style={[styles.editor, { backgroundColor: ds.c.raised, borderColor: ds.c.lineStrong }]}>
      <Field
        label={`${drink.name}’s price`}
        value={draft}
        onChangeText={setDraft}
        placeholder="12.00 or MP"
        hint={`Every menu with this drink prints it, unless the menu has its own.${alsoOn ? ` Also on ${alsoOn}.` : ''}`}
        autoFocus={!drink.menuPrice}
        returnKeyType="done"
        onSubmitEditing={() => done(draft, menuDraft)}
      />
      {suggested ? (
        <View style={[styles.suggest, { backgroundColor: ds.c.surface, borderColor: ds.c.line }]}>
          <Body>{`Costs ${suggested.cost}. ${suggested.money} clears ${suggested.wants}.`}</Body>
          <View style={styles.actions}>
            <Button label={`Use ${suggested.money}`} variant="secondary" size="md" onPress={() => setDraft(suggested.text)} />
          </View>
        </View>
      ) : null}
      <Field
        label={`On ${pricing.menuName} only`}
        value={menuDraft}
        onChangeText={setMenuDraft}
        placeholder={formatPrice(draft) ?? 'Price'}
        hint={`Empty: ${pricing.menuName} prints ${formatPrice(draft) ?? 'no price'}.`}
        autoFocus={!!drink.menuPrice}
        returnKeyType="done"
        onSubmitEditing={() => done(draft, menuDraft)}
      />
      <View style={styles.actions}>
        {menuDraft.trim() ? (
          <Button label="Clear this menu’s price" variant="secondary" size="md" onPress={() => done(draft, null)} />
        ) : (
          <Button label="Clear" variant="secondary" size="md" onPress={() => done(null, null)} />
        )}
        <Button label="Done" size="md" onPress={() => done(draft, menuDraft)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { gap: space.sm, padding: space.md, borderRadius: radius.card, borderWidth: 1, marginBottom: space.sm },
  suggest: { gap: space.sm, padding: space.md, borderRadius: radius.card, borderWidth: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
