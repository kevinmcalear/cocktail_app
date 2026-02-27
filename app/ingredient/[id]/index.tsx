import { GenerateImageButton } from "@/components/GenerateImageButton";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useIngredient } from "@/hooks/useIngredients";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
    ActivityIndicator, ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, YStack } from "tamagui";

interface IngredientDetail {
    id: string;
    name: string;
    description: string | null;
    is_batch: boolean;
    ingredient_images?: { images: { url: string } }[];
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

    const { data, isLoading: loading, error } = useIngredient(id as string);
    const ingredient = data?.ingredient as IngredientDetail | null;
    const recipe = data?.recipe as unknown as RecipeItem[] || [];
    const usedIn = data?.usedIn || [];

    if (loading) {
        return (
            <YStack backgroundColor="$background" style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.dark.tint} />
                </View>
            </YStack>
        );
    }

    if (!ingredient) {
        return (
            <YStack backgroundColor="$background" style={styles.container}>
                <View style={styles.center}>
                    <Text>Ingredient not found.</Text>
                </View>
            </YStack>
        );
    }

    return (
        <YStack backgroundColor="$background" style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
                    <IconSymbol name="chevron.left" size={24} color={Colors.dark.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { fontSize: 20 }]}>{ingredient.name}</Text>
                <TouchableOpacity 
                    onPress={() => router.push(`/ingredient/${id}/edit`)} 
                    style={styles.headerBtn}
                >
                    <IconSymbol name="pencil" size={22} color={Colors.dark.tint} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
                
                <View style={{ alignItems: 'center', marginBottom: 10 }}>
                    <View style={{ position: 'relative', width: 140, height: 140, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                        {ingredient.ingredient_images?.[0]?.images?.url ? (
                            <Image 
                                source={{ uri: ingredient.ingredient_images[0].images.url }}
                                style={{ width: '100%', height: '100%' }}
                                contentFit="cover"
                            />
                        ) : (
                            <GenerateImageButton 
                                type="ingredient" 
                                id={ingredient.id} 
                                name={ingredient.name} 
                                variant="placeholder"
                            />
                        )}
                    </View>
                </View>

                {/* Info Card */}
                <GlassView style={styles.card} intensity={10}>
                    <View style={styles.cardHeader}>
                        <IconSymbol name="info.circle" size={24} color={Colors.dark.tint} />
                        <Text style={[styles.cardTitle, { fontSize: 20, fontWeight: 'bold' }]}>About</Text>
                    </View>
                    <Text style={styles.description}>
                        {ingredient.description || "No description provided."}
                    </Text>
                    {/* Could show tags like "Batch" here */}
                </GlassView>

                {/* Recipe Section (Only if it has recipes) */}
                {recipe.length > 0 && (
                    <GlassView style={styles.card} intensity={10}>
                        <View style={styles.cardHeader}>
                            <IconSymbol name="flask" size={24} color={Colors.dark.tint} />
                            <Text style={[styles.cardTitle, { fontSize: 20, fontWeight: 'bold' }]}>Build Spec</Text>
                        </View>
                        
                        <View style={styles.recipeList}>
                            {recipe.map((item, index) => (
                                <View key={item.id} style={[styles.recipeRow, index !== recipe.length - 1 && styles.recipeBorder]}>
                                    <Text style={styles.recipeName}>{item.is_top ? `Top ` : ''}{item.ingredient?.name || "Unknown"}</Text>
                                    <View style={styles.amounts}>
                                        {item.ingredient_ml && <Text style={styles.amountText}>{item.ingredient_ml} ml</Text>}
                                        {item.ingredient_bsp && <Text style={styles.amountText}>{item.ingredient_bsp} bsp</Text>}
                                        {item.ingredient_dash && <Text style={styles.amountText}>{item.ingredient_dash} dash</Text>}
                                        {item.ingredient_amount && <Text style={styles.amountText}>{item.ingredient_amount}x</Text>}
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
                            <Text style={[styles.cardTitle, { fontSize: 20, fontWeight: 'bold' }]}>Used In</Text>
                        </View>
                        <View style={styles.recipeList}>
                            {usedIn.map((item: any, index: number) => {
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
                                            <Text style={styles.recipeName}>{item.cocktail.name}</Text>
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
        </YStack>
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
        fontFamily: 'IBMPlexSansItalic',
        fontWeight: 'normal',
        fontStyle: 'italic',
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
