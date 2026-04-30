import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Paragraph, ScrollView as TamaguiScrollView, Text, YStack, useTheme } from "tamagui";

import { ItemDetailLayout } from "@/components/ItemDetailLayout";
import { GlassView } from "@/components/ui/GlassView";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useBars } from "@/hooks/useBars";
import { useFavorites } from "@/hooks/useFavorites";
import { useIngredient } from "@/hooks/useIngredients";
import { useStudyPile } from "@/hooks/useStudyPile";
import { useAppStore } from "@/store/useAppStore";

interface IngredientDetail {
    id: string;
    name: string;
    description: string | null;
    item_images?: { images: { url: string } }[];
}

interface RecipeItem {
    id: string;
    ingredient: { name: string };
    amount: string | null;
    unit: string | null;
    preparation_notes: string | null;
    is_optional: boolean | null;
}

export default function IngredientDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const theme = useTheme();

    const { isFavorite, toggleFavorite } = useFavorites();
    const { toggleStudyPile, isInStudyPile } = useStudyPile();

    const { data, isLoading: loading, error } = useIngredient(id as string);
    const ingredient = data?.ingredient as IngredientDetail | null;
    const recipe = data?.recipe as unknown as RecipeItem[] || [];
    const usedIn = data?.usedIn || [];

    const selectedBarId = useAppStore((state) => state.selectedBarId);
    const { data: bars } = useBars();
    const currentBarRole = bars?.find((b) => b.bar_id === selectedBarId)?.role_level || 10;
    const canViewDetails = currentBarRole > 30; // Admin (40) can see complex ingredient details.

    if (loading || !ingredient) {
        return (
            <ItemDetailLayout 
                id={id as string}
                title={loading ? "Loading..." : "Not Found"}
                images={[]}
                isLoading={loading}
                isFavorite={false}
                isInStudyPile={false}
                onToggleFavorite={() => {}}
                onToggleStudyPile={() => {}}
            >
                <YStack style={styles.container} justifyContent="center" alignItems="center">
                    <Text color="$color">{loading ? "Loading Ingredient..." : "Ingredient not found."}</Text>
                    {error && <Text color="$red10">Error: {error.message || JSON.stringify(error)}</Text>}
                </YStack>
            </ItemDetailLayout>
        );
    }

    const images = ingredient.item_images?.map(img => img.images.url).filter(Boolean) as string[] || [];
    if (images.length === 0) {
        images.push(require('@/assets/images/cocktails/house_martini.png'));
    }

    return (
        <ItemDetailLayout
            id={`ingredient-${ingredient.id}`}
            title={ingredient.name}
            images={images}
            isFavorite={isFavorite(`ingredient-${ingredient.id}`)}
            isInStudyPile={isInStudyPile(`ingredient-${ingredient.id}`)}
            onToggleFavorite={toggleFavorite}
            onToggleStudyPile={toggleStudyPile}
            onEditPress={canViewDetails ? () => router.push(`/ingredient/${id}/edit`) : undefined}
        >
            <YStack paddingHorizontal="$4" gap="$4" paddingBottom="$8">

                {/* Info Card */}
                {(!recipe.length || canViewDetails) && (ingredient.description || recipe.length > 0) && (
                    <GlassView style={styles.card} intensity={10}>
                        <View style={styles.cardHeader}>
                            <IconSymbol name="info.circle" size={24} color={theme.color?.get() as string} />
                            <Text style={[styles.cardTitle, { color: theme.color?.get() as string }]}>About</Text>
                            {recipe.length > 0 && (
                                <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginLeft: 'auto' }}>
                                    <Text style={{ color: theme.color?.get() as string, fontSize: 12, fontWeight: 'bold' }}>BATCH</Text>
                                </View>
                            )}
                        </View>
                        <Paragraph style={[styles.description, { color: theme.color?.get() as string, opacity: 0.8 }]}>
                            {ingredient.description || "No description provided."}
                        </Paragraph>
                    </GlassView>
                )}

                {/* Recipe Section (Only if it has recipes / is a batch) */}
                {canViewDetails && recipe.length > 0 && (
                    <GlassView style={styles.card} intensity={10}>
                        <View style={styles.cardHeader}>
                            <IconSymbol name="flask" size={24} color={theme.color?.get() as string} />
                            <Text style={[styles.cardTitle, { color: theme.color?.get() as string }]}>Build Spec</Text>
                        </View>
                        
                        <View style={styles.recipeList}>
                            {recipe.map((item, index) => (
                                <View key={item.id} style={[styles.recipeRow, index !== recipe.length - 1 && styles.recipeBorder]}>
                                    <Text style={[styles.recipeName, { color: theme.color?.get() as string }]}>{item.ingredient?.name || "Unknown"}</Text>
                                    <View style={styles.amounts}>
                                        {item.amount && <Text style={[styles.amountText, { color: theme.color?.get() as string }]}>{item.amount}</Text>}
                                        {item.unit && <Text style={[styles.amountText, { color: theme.color?.get() as string }]}>{item.unit}</Text>}
                                    </View>
                                </View>
                            ))}
                        </View>
                    </GlassView>
                )}

                {/* Used In Section (Horizontal Scroll) */}
                {usedIn.length > 0 && (
                    <View style={styles.horizontalSection}>
                        <View style={[styles.cardHeader, { paddingHorizontal: 20 }]}>
                            <IconSymbol name="wineglass" size={24} color={theme.color?.get() as string} />
                            <Text style={[styles.cardTitle, { color: theme.color?.get() as string }]}>Cocktails with {ingredient.name}</Text>
                        </View>
                        <TamaguiScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.horizontalScrollContent}
                        >
                            {usedIn.map((item: any) => {
                                const imageUrl = item.cocktail.item_images?.[0]?.images?.url;
                                
                                return (
                                    <TouchableOpacity 
                                        key={item.id} 
                                        style={styles.horizontalCard}
                                        onPress={() => router.push(`/cocktail/${item.cocktail.id}`)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={styles.horizontalCardImageContainer}>
                                            <Image 
                                                source={imageUrl ? { uri: imageUrl } : require('@/assets/images/cocktails/house_martini.png')}
                                                style={styles.horizontalCardImage}
                                                contentFit="cover"
                                            />
                                        </View>
                                        <Text style={[styles.horizontalCardTitle, { color: theme.color?.get() as string }]} numberOfLines={2}>
                                            {item.cocktail.name}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </TamaguiScrollView>
                    </View> 
                )}
            </YStack>
        </ItemDetailLayout>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
        fontSize: 20,
        fontWeight: 'bold',
    },
    description: {
        fontSize: 16,
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
        fontWeight: '500'
    },
    amounts: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center'
    },
    amountText: {
        fontSize: 15,
        fontWeight: '600',
        opacity: 0.8
    },
    horizontalSection: {
        marginTop: 8,
        marginBottom: 16,
        marginHorizontal: -16, // Bleed to edges assuming parent padding is 16/20
    },
    horizontalScrollContent: {
        paddingHorizontal: 20, // Initial offset
        gap: 16,
        paddingBottom: 20,
    },
    horizontalCard: {
        width: 140,
        gap: 8,
    },
    horizontalCardImageContainer: {
        width: 140,
        height: 140,
        borderRadius: 24, // High border radius for Squircle effect
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderCurve: 'continuous', // Squircle effect on iOS
    },
    horizontalCardImage: {
        width: '100%',
        height: '100%',
        borderRadius: 24, // Ensure image is also rounded
        borderCurve: 'continuous',
    },
    horizontalCardTitle: {
        fontSize: 14,
        fontWeight: '600',
        paddingHorizontal: 4,
        lineHeight: 18,
    }
});
