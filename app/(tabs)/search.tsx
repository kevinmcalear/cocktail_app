import { SearchItem, SearchList } from "@/components/SearchList";
import { useBeers } from "@/hooks/useBeers";
import { useCocktails } from "@/hooks/useCocktails";
import { useIngredients } from "@/hooks/useIngredients";
import { useWines } from "@/hooks/useWines";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";

export default function SearchScreen() {
    const router = useRouter();
    const { q } = useLocalSearchParams<{ q?: string }>();
    const [items, setItems] = useState<SearchItem[]>([]);

    const { data: cocktailsData, isLoading: cocktailsLoading, error: cocktailsError } = useCocktails();
    const { data: beersData, isLoading: beersLoading, error: beersError } = useBeers();
    const { data: winesData, isLoading: winesLoading, error: winesError } = useWines();
    const { data: ingredientsData, isLoading: ingredientsLoading, error: ingredientsError } = useIngredients();

    useEffect(() => {
        if (!cocktailsData && !beersData && !winesData && !ingredientsData) return;

        const mappedCocktails: SearchItem[] = (cocktailsData || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            category: "Cocktail",
            recipes: c.recipes,
            cocktail_images: c.cocktail_images
        }));

        // Keeping prefix 'beer-' logic matching old drinks.tsx
        const mappedBeers: SearchItem[] = (beersData || []).map((b: any) => ({
            id: `beer-${b.id}`,
            name: b.name,
            description: b.description,
            category: "Beer",
            price: b.price,
            image: b.beer_images?.[0]?.images?.url ? { uri: b.beer_images[0].images.url } : undefined
        }));

        // Keeping prefix 'wine-' logic matching old drinks.tsx
        const mappedWines: SearchItem[] = (winesData || []).map((w: any) => ({
            id: `wine-${w.id}`,
            name: w.name,
            description: w.description,
            category: "Wine",
            price: w.price,
            image: w.wine_images?.[0]?.images?.url ? { uri: w.wine_images[0].images.url } : undefined
        }));

        // using plain ID for ingredients because ingredient routes relied on the plain ID
        const mappedIngredients: SearchItem[] = (ingredientsData || []).map((i: any) => ({
            id: i.id,
            name: i.name,
            description: i.description,
            category: "Ingredient",
            image: i.ingredient_images?.[0]?.images?.url ? { uri: i.ingredient_images[0].images.url } : undefined
        }));

        setItems([...mappedCocktails, ...mappedBeers, ...mappedWines, ...mappedIngredients]);
    }, [cocktailsData, beersData, winesData, ingredientsData]);

    if (cocktailsError || beersError || winesError || ingredientsError) {
        console.error('Error fetching search items:', cocktailsError || beersError || winesError || ingredientsError);
    }

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <SearchList
                title="Search"
                items={items}
                initialSearchQuery={q}
                hideHeader={true}
            />
        </>
    );
}
