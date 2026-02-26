import { DrinkList, DrinkListItem } from "@/components/DrinkList";
import { useBeers } from "@/hooks/useBeers";
import { useCocktails } from "@/hooks/useCocktails";
import { useWines } from "@/hooks/useWines";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";

export default function DrinksScreen() {
    const router = useRouter();
    const { q } = useLocalSearchParams<{ q?: string }>();
    const [drinks, setDrinks] = useState<DrinkListItem[]>([]);

    const { data: cocktailsData, isLoading: cocktailsLoading, error: cocktailsError } = useCocktails();
    const { data: beersData, isLoading: beersLoading, error: beersError } = useBeers();
    const { data: winesData, isLoading: winesLoading, error: winesError } = useWines();

    useEffect(() => {
        if (!cocktailsData && !beersData && !winesData) return;

        const mappedCocktails: DrinkListItem[] = (cocktailsData || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            category: "Cocktail",
            recipes: c.recipes,
            cocktail_images: c.cocktail_images
        }));

        const mappedBeers: DrinkListItem[] = (beersData || []).map((b: any) => ({
            id: `beer-${b.id}`,
            name: b.name,
            description: b.description,
            category: "Beer",
            price: b.price,
            image: b.beer_images?.[0]?.images?.url ? { uri: b.beer_images[0].images.url } : undefined
        }));

        const mappedWines: DrinkListItem[] = (winesData || []).map((w: any) => ({
            id: `wine-${w.id}`,
            name: w.name,
            description: w.description,
            category: "Wine",
            price: w.price,
            image: w.wine_images?.[0]?.images?.url ? { uri: w.wine_images[0].images.url } : undefined
        }));

        setDrinks([...mappedCocktails, ...mappedBeers, ...mappedWines]);
    }, [cocktailsData, beersData, winesData]);

    if (cocktailsError || beersError || winesError) {
        console.error('Error fetching drinks:', cocktailsError || beersError || winesError);
    }

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <DrinkList
                title="Drinks"
                drinks={drinks}
                initialSearchQuery={q}
                hideHeader={true}
            />
        </>
    );
}

