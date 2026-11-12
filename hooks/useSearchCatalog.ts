import type { SearchItem } from '@/types/search';
import { useBeers } from '@/hooks/useBeers';
import { useCocktails } from '@/hooks/useCocktails';
import { useDrafts } from '@/hooks/useDrafts';
import { useAllIngredients, useDropdowns, useVenueIngredients } from '@/hooks/useDropdowns';
import { useWines } from '@/hooks/useWines';
import { inSelectedContext, PERSONAL_CONTEXT } from '@/lib/barContextFilter';
import { draftMethodIds } from '@/lib/drinkMethods';
import { batchedDrinkKey, nameKey, withDrinkPhotos, type ItemImageLink } from '@/lib/itemImages';
import { toCocktailSearchItem, toIngredientSearchItem, toPourSearchItem } from '@/lib/searchCards';
import { isHiddenFromSearch } from '@/lib/searchVisibility';
import { capitalize, capitalizeFirst } from '@/lib/stringUtils';
import { useMemo } from 'react';

const DRAFT_CATEGORY: Record<string, SearchItem['category']> = {
  cocktail: 'Cocktail',
  beer: 'Beer',
  wine: 'Wine',
  ingredient: 'Ingredient',
  menu: 'Menu',
};

function draftSearchId(entityType: string, id: string) {
  if (entityType === 'beer') return `beer-${id}`;
  if (entityType === 'wine') return `wine-${id}`;
  if (entityType === 'menu') return `menu-${id}`;
  return id;
}

function draftDisplayName(d: { entity_type: string; draft_data?: any }) {
  const data = d.draft_data || {};
  const raw =
    data.name ||
    data.menuName ||
    `Untitled ${capitalize(d.entity_type || 'Draft')}`;
  return capitalize(raw);
}

/**
 * Unified catalog for the Library and search, filtered to `contextIds` (the
 * active venue, or personal at home; see venueContextIds and useSearchMine).
 * Pass a stable array, since it's a memo dependency.
 */
export function useSearchCatalog(selectedContextIds: string[], { ingredients = true }: { ingredients?: boolean } = {}) {
  // At venues, only their rows: a venue's few hundred instead of the whole
  // ~30,000-row catalog (saved between launches, so the Library paints at
  // once). No venues yet (still loading) asks for nothing. Home asks for the
  // bar-less rows only, which are all it shows, not every bar's drinks too.
  const barIds = useMemo(
    () => (selectedContextIds.includes(PERSONAL_CONTEXT) ? undefined : selectedContextIds),
    [selectedContextIds]
  );
  const { data: cocktailsData, isLoading: cocktailsLoading, error: cocktailsError } = useCocktails(barIds ?? 'home');
  const { data: beersData, isLoading: beersLoading, error: beersError } = useBeers(barIds ?? 'home');
  const { data: winesData, isLoading: winesLoading, error: winesError } = useWines(barIds ?? 'home');
  // At home, the slim catalog the pickers share (saved on the device); at a venue, its rows with their pictures.
  // Both off for a search that shows only drinks.
  const homeIngredients = useAllIngredients(ingredients && !barIds);
  const venueIngredients = useVenueIngredients(barIds ?? [], ingredients && !!barIds);
  const { data: ingredientsData, isLoading: ingredientsLoading, error: ingredientsError } = barIds ? venueIngredients : homeIngredients;
  const { data: dropdowns, isLoading: menusLoading } = useDropdowns({ menus: true });
  const { drafts, isLoading: draftsLoading } = useDrafts();

  const items = useMemo(() => {
    const mappedCocktails: SearchItem[] = (cocktailsData || [])
      .filter((c: any) => inSelectedContext(c.bar_id, selectedContextIds))
      .map(toCocktailSearchItem);

    const mappedBeers: SearchItem[] = (beersData || [])
      .filter((b: any) => inSelectedContext(b.bar_id, selectedContextIds))
      .map((b: any) => toPourSearchItem('Beer', b));

    const mappedWines: SearchItem[] = (winesData || [])
      .filter((w: any) => inSelectedContext(w.bar_id, selectedContextIds))
      .map((w: any) => toPourSearchItem('Wine', w));

    // A batch shows its drink's photo until it has its own ("Aperol Fizz Batch" shows the Aperol Fizz).
    type Pictured = { name: string | null; bar_id: string | null; item_images?: ItemImageLink[] | null };
    const drinkImages = new Map(
      ((cocktailsData || []) as Pictured[]).map((c) => [`${c.bar_id}|${nameKey(c.name ?? '')}`, c.item_images])
    );
    const batchImages = (i: Pictured) => {
      const drink = batchedDrinkKey(i.name ?? '');
      return drink ? withDrinkPhotos(i.item_images, drinkImages.get(`${i.bar_id}|${drink}`)) : i.item_images;
    };

    const mappedIngredients: SearchItem[] = (ingredientsData || [])
      .filter(
        (i: any) =>
          !isHiddenFromSearch(i) && inSelectedContext(i.bar_id, selectedContextIds)
      )
      .map((i: any) => toIngredientSearchItem(i, batchImages(i)));

    const mappedMenus: SearchItem[] = (dropdowns?.menus || [])
      .filter((m: any) => inSelectedContext(m.bar_id, selectedContextIds))
      .map((m: any) => ({
        id: `menu-${m.id}`,
        name: m.name,
        description: 'Menu',
        category: 'Menu' as const,
      }));

    const mappedDrafts: SearchItem[] = drafts
      .filter(
        (d: any) =>
          DRAFT_CATEGORY[d.entity_type] &&
          !isHiddenFromSearch(d) &&
          inSelectedContext(d.bar_id, selectedContextIds)
      )
      .map((d: any) => {
        const data = d.draft_data || {};
        const category = DRAFT_CATEGORY[d.entity_type]!;
        return {
          id: draftSearchId(d.entity_type, d.id),
          name: draftDisplayName(d),
          description: data.description,
          category,
          isDraft: true,
          recipes:
            data.recipeItems?.map((ri: any) => ({
              ingredient_item_id: ri.ingredient_id,
              ingredient: { name: capitalizeFirst(ri.name || 'Unknown') },
            })) || [],
          image: data.localImages?.[0]?.url
            ? { uri: data.localImages[0].url }
            : undefined,
          method_id: draftMethodIds(data)[0] ?? data.method_id ?? null,
          glassware_id: data.glasswareId ?? data.glassware_id ?? null,
          ice_id: data.iceId ?? data.ice_id ?? null,
          item_categories: (data.selectedCategories || []).map((id: string) => ({
            category_id: id,
          })),
          price: data.price,
        } satisfies SearchItem;
      });

    return [
      ...mappedMenus,
      ...mappedCocktails,
      ...mappedBeers,
      ...mappedWines,
      ...mappedIngredients,
      ...mappedDrafts,
    ];
  }, [
    cocktailsData,
    beersData,
    winesData,
    ingredientsData,
    dropdowns?.menus,
    drafts,
    selectedContextIds,
  ]);

  const isLoading =
    selectedContextIds.length === 0 ||
    cocktailsLoading ||
    beersLoading ||
    winesLoading ||
    ingredientsLoading ||
    menusLoading ||
    draftsLoading;
  const error = cocktailsError || beersError || winesError || ingredientsError;

  return { items, isLoading, error };
}
