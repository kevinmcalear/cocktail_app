import { SearchItem, SearchList } from "@/components/SearchList";
import { useCocktails } from "@/hooks/useCocktails";
import { useIngredients } from "@/hooks/useIngredients";
import { useBeers } from "@/hooks/useBeers";
import { useWines } from "@/hooks/useWines";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useMemo } from "react";
import { Alert, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Text, useTheme, Sheet, YStack, XStack } from "tamagui";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function AssignItemsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const queryClient = useQueryClient();
    const theme = useTheme();
    const [showCreateSheet, setShowCreateSheet] = useState(false);

    // Fetch all items
    const { data: cocktails } = useCocktails({ allContexts: true });
    const { data: ingredients } = useIngredients({ allContexts: true });
    const { data: beers } = useBeers({ allContexts: true });
    const { data: wines } = useWines({ allContexts: true });

    const allItems = useMemo(() => {
        const mappedCocktails = (cocktails || []).map((c: any) => ({ ...c, category: "Cocktail" }));
        const mappedIngredients = (ingredients || []).map((i: any) => ({ ...i, category: "Ingredient" }));
        const mappedBeers = (beers || []).map((b: any) => ({ ...b, category: "Beer" }));
        const mappedWines = (wines || []).map((w: any) => ({ ...w, category: "Wine" }));

        const combined = [...mappedCocktails, ...mappedIngredients, ...mappedBeers, ...mappedWines];
        return combined.filter(item => item.bar_id !== id) as SearchItem[];
    }, [cocktails, ingredients, beers, wines, id]);

    const handleDrinkPress = async (item: SearchItem) => {
        try {
            const { error } = await supabase.rpc('assign_item_to_bar', {
                p_item_id: item.id,
                p_bar_id: id
            });

            if (error) throw new Error(error.message);

            queryClient.invalidateQueries({ queryKey: ['bar', id] });
            queryClient.invalidateQueries({ queryKey: ['cocktails'] });
            queryClient.invalidateQueries({ queryKey: ['ingredients'] });
            queryClient.invalidateQueries({ queryKey: ['beers'] });
            queryClient.invalidateQueries({ queryKey: ['wines'] });

            Alert.alert("Assigned", `${item.name} assigned successfully.`);
            router.back();
        } catch (err: any) {
            Alert.alert("Error", err.message);
        }
    };

    const headerButtons = (
        <XStack paddingHorizontal="$4" marginBottom="$2" justifyContent="flex-end">
            <Button 
                onPress={() => setShowCreateSheet(true)} 
                backgroundColor="$color8" 
                size="$3" 
                borderRadius="$10"
            >
                <XStack gap="$2" alignItems="center">
                    <IconSymbol name="plus" size={16} color={theme.backgroundStrong?.get() as string} />
                    <Text color={theme.backgroundStrong?.get() as string} fontWeight="bold">Create New</Text>
                </XStack>
            </Button>
        </XStack>
    );

    return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
            <SearchList 
                title="Assign Item" 
                items={allItems} 
                onDrinkPress={handleDrinkPress}
                headerButtons={headerButtons}
                isModal={false}
            />

            <Sheet 
                modal 
                open={showCreateSheet} 
                onOpenChange={setShowCreateSheet} 
                snapPointsMode="fit"
                dismissOnSnapToBottom
            >
                <Sheet.Overlay />
                <Sheet.Frame padding="$4" backgroundColor="$backgroundStrong" borderTopLeftRadius="$6" borderTopRightRadius="$6" paddingBottom={40}>
                    <Sheet.Handle />
                    <YStack gap="$4" marginTop="$4">
                        <Text fontSize="$6" fontWeight="bold" color="$color" textAlign="center" marginBottom="$2">Create New Item</Text>
                        
                        <Button onPress={() => { setShowCreateSheet(false); router.push(`/add-cocktail?barId=${id}`); }} backgroundColor="$color4" size="$4">
                            <Text color="$color">Cocktail</Text>
                        </Button>
                        <Button onPress={() => { setShowCreateSheet(false); router.push(`/add-beer?barId=${id}`); }} backgroundColor="$color4" size="$4">
                            <Text color="$color">Beer</Text>
                        </Button>
                        <Button onPress={() => { setShowCreateSheet(false); router.push(`/add-wine?barId=${id}`); }} backgroundColor="$color4" size="$4">
                            <Text color="$color">Wine</Text>
                        </Button>
                        <Button onPress={() => { setShowCreateSheet(false); router.push(`/add-ingredient?barId=${id}`); }} backgroundColor="$color4" size="$4">
                            <Text color="$color">Ingredient</Text>
                        </Button>
                    </YStack>
                </Sheet.Frame>
            </Sheet>
        </View>
    );
}
