import { useViewAs } from '@/hooks/useViewAs';
import { supabase } from '@/lib/supabase';
import { resolvePresentationIngredient, sortRecipesByOrder } from '@/lib/recipeUtils';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useDebounced } from '@/hooks/useDiscover';
import { batchedDrinkName, nameKey, withDrinkPhotos, type ItemImageLink } from '@/lib/itemImages';

/** A row of ingredient_used_in. */
interface UsedInRow {
    id: string;
    name: string;
    image_url: string | null;
    image_is_generated: boolean | null;
}

/** A bottle you can buy that's a kind of the ingredient on the page. */
export interface IngredientBottle {
    id: string;
    name: string;
    brand_maker: string | null;
    abv: number | null;
}

/**
 * The photos of the drink a batch makes ("Aperol Fizz" for "Aperol Fizz Batch"),
 * from the same venue. Null when it isn't a batch.
 */
async function batchDrinkImages(item: { name: string; bar_id: string | null }) {
    const drink = batchedDrinkName(item.name);
    if (!drink) return null;
    let query = supabase
        .from('app_item_presentation')
        .select('name, item_images ( angle, sort_order, is_generated, images ( url ) )')
        .eq('item_type', 'cocktail')
        .ilike('name', drink.replace(/[\\%_]/g, '\\$&'));
    query = item.bar_id ? query.eq('bar_id', item.bar_id) : query.is('bar_id', null);
    // A missing photo is not worth failing the page over.
    const { data } = await query.limit(5);
    return (data ?? []).find((d) => nameKey(d.name ?? '') === nameKey(drink))?.item_images as ItemImageLink[] | null ?? null;
}

// Single ingredient detail query, including where it's used
export function useIngredient(id?: string | string[]) {
    const { viewAsRoleLevel } = useViewAs();
    return useQuery({
        queryKey: ['ingredient', id, viewAsRoleLevel],
        queryFn: async () => {
            if (!id) return null;
            const ingredientId = Array.isArray(id) ? id[0] : id;

            // 1. Fetch Ingredient Info
            const { data: ingredient, error: ingError } = await supabase
                .from('app_item_presentation')
                .select(`
                    *,
                    item_images (
                        sort_order,
                        image_id,
                        is_generated,
                        outdated_since,
                        images ( id, url, palette )
                    )
                `)
                .eq('id', ingredientId)
                .single();

            if (ingError) throw ingError;

            // What it's a kind of, and the bottle a prep is made from. A second
            // read: the self-referencing keys are ambiguous to embed through the view.
            const linkIds = [ingredient.generic_id, ingredient.made_from_id].filter((x): x is string => !!x);
            const links = linkIds.length
                ? (await supabase.from('app_item_presentation').select('id, name').in('id', linkIds)).data ?? []
                : [];
            const generic = links.find((l) => l.id === ingredient.generic_id) ?? null;
            const madeFrom = links.find((l) => l.id === ingredient.made_from_id) ?? null;

            // The bottles that are a kind of it (Sweet Vermouth: Carpano Antica, Cocchi...).
            // Only styles have them; a failed read leaves the list out.
            const { data: bottles } = ingredient.ingredient_role === 'product'
                ? { data: [] }
                : await supabase
                    .from('app_item_presentation')
                    .select('id, name, brand_maker, abv')
                    .eq('generic_id', ingredientId)
                    .eq('ingredient_role', 'product')
                    .order('name')
                    .limit(500);

            // 2. Fetch Recipe (sub-ingredients)
            const { data: rawRecipe, error: recipeError } = await supabase
                .from('app_recipe_presentation')
                .select(`
                    id,
                    sort_order,
                    created_at,
                    display_ingredient_id,
                    amount,
                    unit,
                    preparation_notes,
                    is_optional,
                    display_ingredient(id, name, ingredient_role)
                `)
                .eq('recipe_item_id', ingredientId);

            if (recipeError) throw recipeError;

            const recipe = sortRecipesByOrder(rawRecipe)?.map((r: any) => ({
                ...r,
                ingredient: resolvePresentationIngredient(r),
            }));

            // 3. Cocktails that use this ingredient, as the caller's recipe view shows them
            // (ingredient_used_in, supabase/migrations/20261008340000_my_bar_rpc.sql). A
            // failed read leaves the section out rather than failing the page.
            const { data: usedInData } = await supabase.rpc('ingredient_used_in', { p_ingredient_id: ingredientId, p_limit: 200 });
            const usedIn = ((usedInData ?? []) as UsedInRow[]).map((d) => ({
                id: d.id,
                cocktail: {
                    id: d.id,
                    name: d.name,
                    item_type: 'cocktail' as const,
                    item_images: d.image_url ? [{ angle: 'hero' as const, is_generated: d.image_is_generated, images: { url: d.image_url } }] : [],
                },
            }));

            return {
                ingredient: { ...ingredient, generic, madeFrom },
                bottles: (bottles ?? []) as IngredientBottle[],
                // Ingredients are drawn, never photographed: only a batch shows the photos of
                // the drink it makes. Kept apart so the edit screen never saves them.
                heroImages: withDrinkPhotos([], await batchDrinkImages(ingredient)),
                recipe: recipe || [],
                usedIn
            };
        },
        enabled: !!id,
    });
}

/**
 * Shared ingredients (no venue) whose name has the text in it, searched on
 * the server once typing pauses, so search never downloads the whole list.
 */
export function usePublicIngredientSearch(search: string) {
    const term = useDebounced(search.replace(/[%_\\]/g, '').trim(), 200);
    return useQuery({
        queryKey: ['ingredient-search', term],
        enabled: term.length >= 2,
        placeholderData: keepPreviousData,
        queryFn: async (): Promise<{ id: string; name: string }[]> => {
            const { data, error } = await supabase
                .from('app_item_presentation')
                .select('id, name')
                .eq('item_type', 'ingredient')
                .is('bar_id', null)
                .ilike('name', `%${term}%`)
                .order('name')
                .order('id')
                .limit(50);
            if (error) throw error;
            return (data ?? []).filter((i): i is { id: string; name: string } => !!i.id && !!i.name);
        },
    });
}

/**
 * "Swap for" on a bottle's page (prep-ing-campari): other bottles of the same
 * kind (Campari: Select Aperitivo, Contratto Bitter). The first few by name.
 */
export function useSwapFor(itemId: string | null, genericId: string | null | undefined) {
    return useQuery({
        queryKey: ['swap-for', itemId, genericId],
        enabled: !!itemId && !!genericId,
        queryFn: async (): Promise<{ id: string; name: string }[]> => {
            const { data, error } = await supabase
                .from('app_item_presentation')
                .select('id, name')
                .eq('generic_id', genericId!)
                .eq('ingredient_role', 'product')
                .neq('id', itemId!)
                .order('name')
                .limit(3);
            if (error) throw error;
            return (data ?? []).filter((r): r is { id: string; name: string } => !!r.id && !!r.name);
        },
    });
}
