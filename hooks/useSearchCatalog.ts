import { SearchItem } from '@/components/SearchList';
import { useBeers } from '@/hooks/useBeers';
import { useCocktails } from '@/hooks/useCocktails';
import { useDrafts } from '@/hooks/useDrafts';
import { useDropdowns } from '@/hooks/useDropdowns';
import { useIngredients } from '@/hooks/useIngredients';
import { useWines } from '@/hooks/useWines';
import { inSelectedContext } from '@/lib/barContextFilter';
import { capitalize } from '@/lib/stringUtils';
import { useAppStore } from '@/store/useAppStore';
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

/** Unified catalog for home + search popover. */
export function useSearchCatalog() {
  const selectedContextIds = useAppStore((s) => s.selectedContextIds);
  // ponytail: fetch all contexts once, filter client-side so venue toggles are instant
  const { data: cocktailsData, isLoading: cocktailsLoading, error: cocktailsError } = useCocktails({
    allContexts: true,
  });
  const { data: beersData, isLoading: beersLoading, error: beersError } = useBeers({
    allContexts: true,
  });
  const { data: winesData, isLoading: winesLoading, error: winesError } = useWines({
    allContexts: true,
  });
  const { data: ingredientsData, isLoading: ingredientsLoading, error: ingredientsError } =
    useIngredients({ allContexts: true });
  const { data: dropdowns, isLoading: menusLoading } = useDropdowns();
  const { drafts, isLoading: draftsLoading } = useDrafts();

  const items = useMemo(() => {
    const mappedCocktails: SearchItem[] = (cocktailsData || [])
      .filter((c: any) => inSelectedContext(c.bar_id, selectedContextIds))
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        category: 'Cocktail' as const,
        recipes: c.recipes,
        item_images: c.item_images,
        item_categories: c.item_categories,
        method_id: c.item_methods?.[0]?.method_item_id ?? null,
        glassware_id: c.glassware_id,
        family_id: c.family_id,
        ice_id: c.ice_id,
      }));

    const mappedBeers: SearchItem[] = (beersData || [])
      .filter((b: any) => inSelectedContext(b.bar_id, selectedContextIds))
      .map((b: any) => ({
        id: `beer-${b.id}`,
        name: b.name,
        description: b.description,
        category: 'Beer' as const,
        price: b.price,
        item_categories: b.item_categories,
        image: b.item_images?.[0]?.images?.url
          ? { uri: b.item_images[0].images.url }
          : undefined,
      }));

    const mappedWines: SearchItem[] = (winesData || [])
      .filter((w: any) => inSelectedContext(w.bar_id, selectedContextIds))
      .map((w: any) => ({
        id: `wine-${w.id}`,
        name: w.name,
        description: w.description,
        category: 'Wine' as const,
        price: w.price,
        item_categories: w.item_categories,
        image: w.item_images?.[0]?.images?.url
          ? { uri: w.item_images[0].images.url }
          : undefined,
      }));

    const mappedIngredients: SearchItem[] = (ingredientsData || [])
      .filter((i: any) => inSelectedContext(i.bar_id, selectedContextIds))
      .map((i: any) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        category: 'Ingredient' as const,
        item_categories: i.item_categories,
        image: i.item_images?.[0]?.images?.url
          ? { uri: i.item_images[0].images.url }
          : undefined,
      }));

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
              ingredient: { name: capitalize(ri.name || 'Unknown') },
            })) || [],
          image: data.localImages?.[0]?.url
            ? { uri: data.localImages[0].url }
            : undefined,
          method_id: data.methodId ?? data.method_id ?? null,
          glassware_id: data.glasswareId ?? data.glassware_id ?? null,
          family_id: data.familyId ?? data.family_id ?? null,
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
    cocktailsLoading ||
    beersLoading ||
    winesLoading ||
    ingredientsLoading ||
    menusLoading ||
    draftsLoading;
  const error = cocktailsError || beersError || winesError || ingredientsError;

  return { items, isLoading, error };
}
