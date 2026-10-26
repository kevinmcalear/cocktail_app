import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, useToast } from '@/components/ds';
import { SetupChromeProvider, SetupPage, useSetupChrome } from '@/components/screens/onboarding/SetupPage';
import { IngredientSearch } from '@/components/screens/addDrink/IngredientSearch';
import { space } from '@/constants/tokens';
import { useBackBarStock, useStockMutations } from '@/hooks/useBackBar';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useIsWideWeb } from '@/hooks/useIsWideWeb';
import { isStockable } from '@/lib/backBar';
import { useRecipeIds } from '@/hooks/useWhatNext';

import { BackBarShelves, type ShelfBottle } from './BackBarShelves';
import { StepFooter } from './GlassesStep';

/**
 * Step 2, your bottles: search finds a brand or a kind (a kind typed in full
 * offers the plain thing first, "Rum, any"), and each pick goes onto a drawn
 * back bar on top that fills as you go (Eddie E39; it replaced the kind chips
 * of call 10). Tap a bottle there to take it off, with Undo. On a laptop the
 * back bar sits beside the search. Search holds bottles only: a recipe like a
 * banana-infused rum is made in-house, not stocked. Saved on the back bar's
 * stock list (fix 12), so the back bar and every "On your back bar" read it
 * straight away.
 */
export function BrandsStep({ barId, name, step, onBack, onNext, onSkip }: { barId: string; name: string; step: string; onBack: () => void; onNext: () => void; onSkip: () => void }) {
  const chrome = useSetupChrome();
  const toast = useToast();
  const wide = useIsWideWeb();
  const dropdowns = useDropdowns({ ingredients: true }).data;
  const stockRows = useBackBarStock(barId).data;
  const stock = useMemo(() => stockRows ?? [], [stockRows]);
  const { add, remove } = useStockMutations(barId);
  const [typing, setTyping] = useState(false);
  const all = dropdowns?.ingredients;
  const recipeRows = useRecipeIds().data;
  // Bottles only: no juice, garnish, the venue's own preps or anything with a recipe (an infusion, a wash).
  const bottles = useMemo(() => {
    const byId = new Map((all ?? []).map((i) => [i.id, i]));
    const recipes = new Set(recipeRows ?? []);
    return (all ?? []).filter(
      (i) =>
        isStockable({ name: i.name ?? '', kind: i.generic_id ? byId.get(i.generic_id)?.name : null, role: i.ingredient_role, ownPrep: i.bar_id === barId }) &&
        (i.ingredient_role === 'product' || !recipes.has(i.id))
    );
  }, [all, barId, recipeRows]);
  const coreIds = useMemo(() => new Set(dropdowns?.coreIngredientIds ?? []), [dropdowns?.coreIngredientIds]);
  const stocked = new Set(stock.map((r) => r.item_id));
  // Oldest first, so a bottle keeps its place on the shelf and the newest goes on the end.
  const shelf = useMemo(() => stock.filter((r) => r.item).map((r) => ({ id: r.item_id, name: r.item?.name ?? '' })).reverse(), [stock]);

  const takeOff = (bottle: ShelfBottle) => {
    const row = stock.find((r) => r.item_id === bottle.id);
    if (!row) return;
    remove.mutate(bottle.id);
    // Undo puts it back in its place: the same time it went on.
    toast.show({ title: `${bottle.name} is off your back bar`, action: { label: 'Undo', onPress: () => add.mutate({ item: bottle, source: row.source, fromName: row.from_name, addedAt: row.added_at }) } });
  };
  const backBar = <BackBarShelves name={name} bottles={shelf} rows={wide ? 3 : 2} onTakeOff={takeOff} />;

  const count = stock.length;
  return (
    <SetupChromeProvider
      value={{ ...chrome, title: 'What’s on your shelves?', intro: 'Search for the bottles on your backbar. You can always add, remove and edit these at any time.', mark: undefined, eyebrow: null, progress: null, topLabel: step, noBack: false, onBack }}
    >
      <SetupPage footer={<StepFooter skip="Skip" onSkip={onSkip} label={count ? `${count} on your back bar · Next` : 'Next'} onPress={onNext} />}>
        {wide ? null : backBar}
        <View style={wide ? styles.columns : styles.stack}>
          <View style={styles.search}>
            <IngredientSearch
              ingredients={bottles}
              aliases={dropdowns?.ingredientAliases}
              coreIds={coreIds}
              loading={!all}
              label="Search a brand or a kind of bottle"
              allowNew={false}
              brands
              backBar={stocked}
              onTyping={setTyping}
              onPick={(pick) => {
                // A pick adds it; taking one off is a tap on the shelf.
                if (pick.id && !stocked.has(pick.id)) add.mutate({ item: { id: pick.id, name: pick.name }, source: 'setup' });
              }}
            />
            {typing ? null : <Caption tone="muted">Infusions, washes and syrups you make aren’t bottles: they’re recipes, made in-house with your drinks.</Caption>}
          </View>
          {wide ? <View style={styles.side}>{backBar}</View> : null}
        </View>
      </SetupPage>
    </SetupChromeProvider>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xl },
  search: { flex: 1, minWidth: 0, gap: space.md },
  // Room for six bottles a shelf beside the results.
  side: { width: 360 },
});
