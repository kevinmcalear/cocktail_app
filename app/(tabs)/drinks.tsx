import { DrinkList, DrinkListItem } from "@/components/DrinkList";
import { beers } from "@/data/beers";
import { wines } from "@/data/wines";
import { useCocktails } from "@/hooks/useCocktails";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";

export default function DrinksScreen() {
    const router = useRouter();
    const { q } = useLocalSearchParams<{ q?: string }>();
    const [drinks, setDrinks] = useState<DrinkListItem[]>([]);

    const { data: cocktailsData, isLoading, error } = useCocktails();

    useEffect(() => {
        if (!cocktailsData) return;

        const mappedCocktails: DrinkListItem[] = cocktailsData.map((c: any) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            category: "Cocktail",
            recipes: c.recipes,
            cocktail_images: c.cocktail_images
        }));

        const mappedBeers: DrinkListItem[] = beers.map(b => ({
            id: `beer-${b.id}`,
            name: b.name,
            description: b.description,
            category: "Beer",
            price: b.price
        }));

        const mappedWines: DrinkListItem[] = wines.map(w => ({
            id: `wine-${w.id}`,
            name: w.name,
            description: w.description,
            category: "Wine",
            price: w.price
        }));

        setDrinks([...mappedCocktails, ...mappedBeers, ...mappedWines]);
    }, [cocktailsData]);

    if (error) {
        console.error('Error fetching drinks:', error);
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

