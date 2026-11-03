import { lazy, Suspense, type ComponentProps } from 'react';

import type * as BeerWine from './BeerWineEditScreen';
import type * as Drink from './DrinkEditScreen';
import type * as Ingredient from '@/components/screens/ingredient/edit/IngredientEditScreen';

const LazyBeerWine = lazy(() => import('./BeerWineEditScreen').then((m) => ({ default: m.BeerWineEditRoute })));
const LazyDrink = lazy(() => import('./DrinkEditScreen').then((m) => ({ default: m.DrinkEditScreen })));
const LazyIngredient = lazy(() => import('@/components/screens/ingredient/edit/IngredientEditScreen').then((m) => ({ default: m.IngredientEditScreen })));
const LazyIngredientDraft = lazy(() => import('@/components/screens/ingredient/edit/IngredientEditScreen').then((m) => ({ default: m.IngredientDraftEditScreen })));

/*
 * On the web an edit route imports its editor lazily, so the editor ships
 * once, in the chunk the drink and ingredient pages already load it from
 * when you edit in place. Imported directly, every edit route's chunk carried
 * its own copy of the whole editor (about 1.8 MB each, quality budget B12).
 */

export function BeerWineEditRoute(props: ComponentProps<typeof BeerWine.BeerWineEditRoute>) {
  return (
    <Suspense fallback={null}>
      <LazyBeerWine {...props} />
    </Suspense>
  );
}

export function DrinkEditScreen(props: ComponentProps<typeof Drink.DrinkEditScreen>) {
  return (
    <Suspense fallback={null}>
      <LazyDrink {...props} />
    </Suspense>
  );
}

export function IngredientEditScreen(props: ComponentProps<typeof Ingredient.IngredientEditScreen>) {
  return (
    <Suspense fallback={null}>
      <LazyIngredient {...props} />
    </Suspense>
  );
}

/** A draft from New › Drafts, at /add-ingredient?draftId= (the same editor's chunk). */
export function IngredientDraftEditScreen(props: ComponentProps<typeof Ingredient.IngredientDraftEditScreen>) {
  return (
    <Suspense fallback={null}>
      <LazyIngredientDraft {...props} />
    </Suspense>
  );
}
