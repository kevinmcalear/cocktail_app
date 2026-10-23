import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Field, PressableScale, Spec, useDs } from '@/components/ds';
import { useSuggestedPrice } from '@/hooks/useSuggestedPrice';
import { layout, radius, space } from '@/constants/tokens';
import { formatPrice, printedPrice } from '@/lib/menus';
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
 * A builder row's price on a phone (venue-menus-prices, steps 2 and 5): the
 * price this menu prints, as typed (in the accent when it's this menu's
 * own), or Add price, to tap. The edit opens under the row (PriceEditor).
 */
export function PriceButton({ drink, open, onPress }: { drink: MenuDrink; open: boolean; onPress: () => void }) {
  const ds = useDs();
  const price = printedPrice(drink);
  const own = !!formatPrice(drink.menuPrice);
  return (
    <PressableScale
      accessibilityLabel={price ? `${drink.name}: price ${price}${own ? ' on this menu' : ''}. Change it` : `Add a price for ${drink.name}`}
      aria-expanded={open}
      onPress={onPress}
      style={price ? styles.price : [styles.add, { borderColor: ds.c.lineStrong }]}
    >
      {price ? <Spec tone={open || own ? 'accent' : 'ink'}>{price}</Spec> : <Caption tone="muted">Add price</Caption>}
    </PressableScale>
  );
}

/**
 * The phone's edit, under the row: the drink's price, a suggested one when it
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

/**
 * A builder row's prices on desktop: the drink's own and this menu's, a field
 * each in every row, so a whole menu can be priced in one pass. An empty
 * menu field shows the drink's price in grey: that's what the menu prints.
 * Each keystroke goes into the layout (autosave waits for a pause), so
 * leaving right after typing still saves it; the fields keep what was typed.
 */
export function PriceFields({ drink, pricing }: { drink: MenuDrink; pricing: RowPricing }) {
  const [draft, setDraft] = useState(drink.price ?? '');
  const [menuDraft, setMenuDraft] = useState(drink.menuPrice ?? '');
  // Use $24.50 (SuggestedPriceLine) sets the price from outside the field.
  // A drink listed twice on the menu: the other row's field changes it too.
  const [seen, setSeen] = useState(drink.price);
  if (drink.price !== seen) {
    setSeen(drink.price);
    if ((drink.price ?? '') !== draft.trim()) setDraft(drink.price ?? '');
  }
  const [seenMenu, setSeenMenu] = useState(drink.menuPrice);
  if (drink.menuPrice !== seenMenu) {
    setSeenMenu(drink.menuPrice);
    if ((drink.menuPrice ?? '') !== menuDraft.trim()) setMenuDraft(drink.menuPrice ?? '');
  }
  return (
    <>
      <View style={styles.field}>
        <Field
          label={`${drink.name}’s price`}
          hideLabel
          value={draft}
          onChangeText={(text) => {
            setDraft(text);
            pricing.onPrice(text);
          }}
          placeholder="Price"
          textAlign="right"
        />
      </View>
      <View style={styles.field}>
        <Field
          label={`${drink.name}’s price on ${pricing.menuName}`}
          hideLabel
          value={menuDraft}
          onChangeText={(text) => {
            setMenuDraft(text);
            pricing.onMenuPrice(text);
          }}
          placeholder={formatPrice(draft) ?? ''}
          textAlign="right"
        />
      </View>
    </>
  );
}

/** Desktop: Use $24.50 under a drink with a cost and no price, and why. Fills the drink's price. */
export function SuggestedPriceLine({ drink, pricing }: { drink: MenuDrink; pricing: RowPricing }) {
  const suggested = useSuggestedPrice(drink.id, pricing.barId, drink.kind === 'cocktail' && !formatPrice(drink.price));
  if (!suggested) return null;
  return (
    <View style={styles.line}>
      <Button label={`Use ${suggested.money}`} accessibilityLabel={`Use ${suggested.money} for ${drink.name}`} variant="secondary" size="sm" onPress={() => pricing.onPrice(suggested.text)} />
      <Caption tone="muted" style={styles.shrink}>{`suggested: costs ${suggested.cost}; clears ${suggested.wants}`}</Caption>
    </View>
  );
}

/** The width of a desktop row's price field: the column heads above them match it. */
export const PRICE_FIELD = 120;

const styles = StyleSheet.create({
  price: { minWidth: layout.minTapTarget, minHeight: layout.minTapTarget, alignItems: 'flex-end', justifyContent: 'center' },
  add: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  editor: { gap: space.sm, padding: space.md, borderRadius: radius.card, borderWidth: 1, marginBottom: space.sm },
  suggest: { gap: space.sm, padding: space.md, borderRadius: radius.card, borderWidth: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  field: { width: PRICE_FIELD },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.sm },
  shrink: { flexShrink: 1 },
});
