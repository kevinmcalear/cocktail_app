import { DrinkList, DrinkListItem } from "@/components/DrinkList";
import { useCocktails } from "@/hooks/useCocktails";
import { useFavorites } from "@/hooks/useFavorites";
import { Stack } from "expo-router";

export default function FavoritesScreen() {
    const { data, isLoading } = useCocktails();
    const { favorites } = useFavorites();

    const cocktails: DrinkListItem[] = data ? data.map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        category: "Cocktail",
        recipes: c.recipes,
        cocktail_images: c.cocktail_images
    })) : [];

    const favoriteCocktails = cocktails.filter(c => favorites.includes(c.id));

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <DrinkList
                title="My Favourites"
                drinks={favoriteCocktails}
            />
        </>
    );
}
