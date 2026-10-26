import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Caption, Chip, useDs } from '@/components/ds';
import { SetupChromeProvider, SetupPage, useSetupChrome } from '@/components/screens/onboarding/SetupPage';
import { IngredientSearch } from '@/components/screens/addDrink/IngredientSearch';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { space } from '@/constants/tokens';
import { useBackBarStock, useStockMutations } from '@/hooks/useBackBar';
import { useDropdowns } from '@/hooks/useDropdowns';
import { isStockable } from '@/lib/backBar';
import { useRecipeIds } from '@/hooks/useWhatNext';
import { anyKind, BRAND_GROUPS, brandGroups } from '@/lib/whatNext';

import { StepFooter } from './GlassesStep';

const STARTERS = new Set(BRAND_GROUPS.map((g) => g.title));

/**
 * Step 2, your brands: tap what the venue stocks, a brand or the plain thing
 * ("just rum"). One chip per kind of bottle starts it (a whole back bar, call
 * 10); search finds a brand or a kind (a kind lists its bottles), and what's
 * picked sits below under its kind. Search holds bottles only: a recipe like
 * a banana-infused rum is made in-house, not stocked. Saved on the back bar's
 * stock list (fix 12), so the back bar and every "On your back bar" read it
 * straight away.
 */
export function BrandsStep({ barId, step, onBack, onNext, onSkip }: { barId: string; step: string; onBack: () => void; onNext: () => void; onSkip: () => void }) {
  const chrome = useSetupChrome();
  const ds = useDs();
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
  // Oldest first, so a chip stays where it was as more go on.
  const groups = useMemo(() => brandGroups(all ?? [], stock.map((r) => r.item_id).reverse()), [all, stock]);

  const toggle = (item: { id: string; name: string | null }) => {
    if (stocked.has(item.id)) remove.mutate(item.id);
    else add.mutate({ item: { id: item.id, name: item.name ?? '' }, source: 'setup' });
  };
  const chip = (item: { id: string; name: string | null }, label: string, a11y = label) => {
    const on = stocked.has(item.id);
    return (
      <Chip
        key={item.id}
        multi
        label={label}
        selected={on}
        accessibilityLabel={on ? `${a11y}, on your back bar` : a11y}
        leading={on ? <IconSymbol name="checkmark" size={14} color={ds.c.ground} /> : undefined}
        onPress={() => toggle(item)}
      />
    );
  };

  const count = stock.length;
  return (
    <SetupChromeProvider
      value={{ ...chrome, title: 'What’s on your shelves?', intro: 'Search for the bottles on your backbar. You can always add, remove and edit these at any time.', mark: undefined, eyebrow: null, progress: null, topLabel: step, noBack: false, onBack }}
    >
      <SetupPage footer={<StepFooter skip="Skip" onSkip={onSkip} label={count ? `${count} on your back bar · Next` : 'Next'} onPress={onNext} />}>
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
            // A pick adds it; taking one off is its chip below.
            if (pick.id && !stocked.has(pick.id)) add.mutate({ item: { id: pick.id, name: pick.name }, source: 'setup' });
          }}
        />
        {typing ? null : !all ? (
          <Caption tone="muted">Loading…</Caption>
        ) : (
          <>
            <View role="group" aria-label="Kinds of bottle" style={styles.wrap}>
              {groups.filter((g) => STARTERS.has(g.title)).flatMap((g) => g.kinds.map((k) => chip(k, g.title, anyKind(k.name ?? ''))))}
            </View>
            {/* What's picked, under its kind; a kind that isn't a starter (a sake) comes with its own Any. */}
            {groups
              .filter((g) => g.picked.length || !STARTERS.has(g.title))
              .map((g, i) => (
                <View key={`${g.title}-${i}`} style={styles.group}>
                  <Caption tone="muted" role="heading">
                    {g.title}
                  </Caption>
                  <View role="group" aria-label={g.title} style={styles.wrap}>
                    {STARTERS.has(g.title) ? null : g.kinds.map((k) => chip(k, anyKind(k.name ?? '')))}
                    {g.picked.map((p) => chip(p, p.name ?? ''))}
                  </View>
                </View>
              ))}
            <Caption tone="muted">Infusions, washes and syrups you make aren’t bottles: they’re recipes, made in-house with your drinks.</Caption>
          </>
        )}
      </SetupPage>
    </SetupChromeProvider>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
