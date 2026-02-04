import { CocktailList, CocktailListItem } from "@/components/CocktailList";
import { useFavorites } from "@/hooks/useFavorites";
import { supabase } from "@/lib/supabase";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";

export default function FavoritesScreen() {
    const [cocktails, setCocktails] = useState<CocktailListItem[]>([]);
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
                        ingredients (
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
            if (data) setCocktails(data as unknown as CocktailListItem[]);
        } catch (error) {
            console.error('Error fetching cocktails:', error);
        }
    };

    const favoriteCocktails = cocktails.filter(c => favorites.includes(c.id));

    return (
        <>
            <Stack.Screen options={{ headerShown: false }} />
            <CocktailList
                title="My Favourites"
                cocktails={favoriteCocktails}
            />
        </>
    );
}
