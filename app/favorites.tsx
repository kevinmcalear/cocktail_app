import { DrinkList, DrinkListItem } from "@/components/DrinkList";
import { useFavorites } from "@/hooks/useFavorites";
import { supabase } from "@/lib/supabase";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";

export default function FavoritesScreen() {
    const [cocktails, setCocktails] = useState<DrinkListItem[]>([]);
    const { favorites } = useFavorites();

    useEffect(() => {
        fetchCocktails();
    }, []);

    const fetchCocktails = async () => {
        try {
            const { data, error } = await supabase
                .from('cocktails')
                .select(`
                    id,
                    name,
                    description,
                    recipes (
                        ingredients!recipes_ingredient_id_fkey (
                            name
                        )
                    ),
                    cocktail_images (
                        images (
                            url
                        )
                    )
                `)
                .order('name', { ascending: true });

            if (error) throw error;
            if (data) {
                const mappedCocktails: DrinkListItem[] = data.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    description: c.description,
                    category: "Cocktail",
                    recipes: c.recipes,
                    cocktail_images: c.cocktail_images
                }));
                setCocktails(mappedCocktails);
            }
        } catch (error) {
            console.error('Error fetching cocktails:', error);
        }
    };

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
