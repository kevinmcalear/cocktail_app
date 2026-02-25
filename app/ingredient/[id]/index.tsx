import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface IngredientDetail {
    id: string;
    name: string;
    description: string | null;
    is_batch: boolean;
}

interface RecipeItem {
    id: string;
    ingredient: { name: string };
    ingredient_bsp: number | null;
    ingredient_ml: number | null;
    ingredient_dash: number | null;
    ingredient_amount: number | null;
    is_top: boolean | null;
}

export default function IngredientDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [ingredient, setIngredient] = useState<IngredientDetail | null>(null);
    const [recipe, setRecipe] = useState<RecipeItem[]>([]);
    const [usedIn, setUsedIn] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) fetchDetail();
    }, [id]);

    const fetchDetail = async () => {
        try {
            setLoading(true);
            
            // 1. Fetch Ingredient Info
            const { data: ingData, error: ingError } = await supabase
                .from('ingredients')
                .select('*')
                .eq('id', id)
                .single();

            if (ingError) throw ingError;
            setIngredient(ingData);

            // 2. Fetch Recipe (sub-ingredients) if any
            // We join on the 'ingredient' relation to get names
            const { data: recipeData, error: recipeError } = await supabase
                .from('recipes')
                .select(`
                    id,
                    ingredient_bsp,
                    ingredient_ml,
                    ingredient_dash,
                    ingredient_amount,
                    is_top,
                    ingredient:ingredients!recipes_ingredient_id_fkey(name)
                `)
                .eq('parent_ingredient_id', id);

            if (recipeError) throw recipeError;
            // Map the result to match our interface (Supabase returns array or null for relations, but here foreign key implies single object usually, wait, 'ingredients' is the table name. )
            // The type definition above `ingredient: { name: string }` expects an object.
            // Supabase JS generic types usually handle this, but we'll cast/check.
            if (recipeData) {
                // @ts-ignore
                setRecipe(recipeData);
            }

            // 3. Fetch cocktails that use this ingredient
            const { data: usedInData, error: usedInError } = await supabase
                .from('recipes')
                .select(`
                    id,
                    cocktail:cocktails(
                        id, 
                        name,
                        cocktail_images (
                            images ( url )
                        )
                    )
                `)
                .eq('ingredient_id', id)
                .not('cocktail', 'is', null);

            if (!usedInError && usedInData) {
                // Remove duplicates if the ingredient is used multiple times in the same cocktail
                const uniqueCocktails = new Map();
                usedInData.forEach((item: any) => {
                    if (item.cocktail && !uniqueCocktails.has(item.cocktail.id)) {
                        uniqueCocktails.set(item.cocktail.id, item);
                    }
                });
                setUsedIn(Array.from(uniqueCocktails.values()));
            }

        } catch (error) {
            console.error("Error fetching ingredient details:", error);
            Alert.alert("Error", "Could not load ingredient details.");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <ThemedView style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.dark.tint} />
                </View>
            </ThemedView>
        );
    }

    if (!ingredient) {
        return (
            <ThemedView style={styles.container}>
                <View style={styles.center}>
                    <ThemedText>Ingredient not found.</ThemedText>
                </View>
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Header */}
            <GlassView style={[styles.header, { paddingTop: insets.top + 10 }]} intensity={80}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <IconSymbol name="chevron.left" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <ThemedText type="subtitle" style={styles.headerTitle}>{ingredient.name}</ThemedText>
                <TouchableOpacity 
                    onPress={() => router.push(`/ingredient/${id}/edit`)} 
                    style={styles.headerBtn}
                >
                    <IconSymbol name="pencil" size={22} color={Colors.dark.tint} />
                </TouchableOpacity>
            </GlassView>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
                
                {/* Info Card */}
                <GlassView style={styles.card} intensity={10}>
                    <View style={styles.cardHeader}>
                        <IconSymbol name="info.circle" size={24} color={Colors.dark.tint} />
                        <ThemedText type="subtitle" style={styles.cardTitle}>About</ThemedText>
                    </View>
                    <ThemedText style={styles.description}>
                        {ingredient.description || "No description provided."}
                    </ThemedText>
                    {/* Could show tags like "Batch" here */}
                </GlassView>

                {/* Recipe Section (Only if it has recipes) */}
                {recipe.length > 0 && (
                    <GlassView style={styles.card} intensity={10}>
                        <View style={styles.cardHeader}>
                            <IconSymbol name="flask" size={24} color={Colors.dark.tint} />
                            <ThemedText type="subtitle" style={styles.cardTitle}>Build Spec</ThemedText>
                        </View>
                        
                        <View style={styles.recipeList}>
                            {recipe.map((item, index) => (
                                <View key={item.id} style={[styles.recipeRow, index !== recipe.length - 1 && styles.recipeBorder]}>
                                    <ThemedText style={styles.recipeName}>{item.is_top ? `Top ` : ''}{item.ingredient?.name || "Unknown"}</ThemedText>
                                    <View style={styles.amounts}>
                                        {item.ingredient_ml && <ThemedText style={styles.amountText}>{item.ingredient_ml} ml</ThemedText>}
                                        {item.ingredient_bsp && <ThemedText style={styles.amountText}>{item.ingredient_bsp} bsp</ThemedText>}
                                        {item.ingredient_dash && <ThemedText style={styles.amountText}>{item.ingredient_dash} dash</ThemedText>}
                                        {item.ingredient_amount && <ThemedText style={styles.amountText}>{item.ingredient_amount}x</ThemedText>}
                                    </View>
                                </View>
                            ))}
                        </View>
                    </GlassView>
                )}

                {/* Used In Section */}
                {usedIn.length > 0 && (
                    <GlassView style={styles.card} intensity={10}>
                        <View style={styles.cardHeader}>
                            <IconSymbol name="wineglass" size={24} color={Colors.dark.tint} />
                            <ThemedText type="subtitle" style={styles.cardTitle}>Used In</ThemedText>
                        </View>
                        <View style={styles.recipeList}>
                            {usedIn.map((item, index) => {
                                const imageUrl = item.cocktail.cocktail_images?.[0]?.images?.url;
                                
                                return (
                                    <TouchableOpacity 
                                        key={item.id} 
                                        style={[styles.recipeRow, index !== usedIn.length - 1 && styles.recipeBorder]}
                                        onPress={() => router.push(`/cocktail/${item.cocktail.id}`)}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                            <Image 
                                                source={imageUrl ? { uri: imageUrl } : require('@/assets/images/cocktails/house_martini.png')}
                                                style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' }}
                                                contentFit="cover"
                                            />
                                            <ThemedText style={styles.recipeName}>{item.cocktail.name}</ThemedText>
                                        </View>
                                        <View style={styles.amounts}>
                                            <IconSymbol name="chevron.right" size={16} color={Colors.dark.tint} />
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </GlassView> 
                )}

            </ScrollView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 20,
        zIndex: 10,
    },
    headerBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 18,
    },
    content: {
        padding: 20,
        gap: 20,
    },
    card: {
        borderRadius: 20,
        padding: 20,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        overflow: 'hidden'
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff'
    },
    description: {
        fontSize: 16,
        color: '#ccc',
        lineHeight: 24
    },
    recipeList: {
        gap: 12
    },
    recipeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4
    },
    recipeBorder: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        paddingBottom: 12,
        marginBottom: 4
    },
    recipeName: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '500'
    },
    amounts: {
        flexDirection: 'row',
        gap: 8
    },
    amountText: {
        fontSize: 15,
        color: Colors.dark.tint,
        fontWeight: '600'
    }
});
