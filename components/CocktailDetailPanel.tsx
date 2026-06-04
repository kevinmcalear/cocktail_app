import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { Paragraph, ScrollView, Text, XStack, YStack, useTheme, Card } from "tamagui";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { useCocktail } from "@/hooks/useCocktails";
import { useBeer } from "@/hooks/useBeers";
import { useWine } from "@/hooks/useWines";
import { useFavorites } from "@/hooks/useFavorites";
import { useStudyPile } from "@/hooks/useStudyPile";
import { useBars } from "@/hooks/useBars";
import { useAppStore } from "@/store/useAppStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { CustomIcon } from "@/components/ui/CustomIcons";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ImageCarousel } from "@/components/ImageCarousel";

interface CocktailDetailPanelProps {
    id: string;
    onIngredientPress?: (ingredientId: string) => void;
    selectedIngredientId?: string | null;
}

export function CocktailDetailPanel({ id, onIngredientPress, selectedIngredientId }: CocktailDetailPanelProps) {
    const router = useRouter();
    const theme = useTheme();
    const { isEditModeEnabled } = useSettingsStore();

    const isBeer = id.startsWith("beer-");
    const isWine = id.startsWith("wine-");
    const safeId = id.replace("beer-", "").replace("wine-", "");

    const { isFavorite, toggleFavorite } = useFavorites();
    const { toggleStudyPile, isInStudyPile } = useStudyPile();

    const selectedBarId = useAppStore((state) => state.selectedBarId);
    const { data: bars } = useBars();
    const currentBarRole = bars?.find((b) => b.bar_id === selectedBarId)?.role_level || 10;
    const canEdit = currentBarRole > 30;

    const [notesExpanded, setNotesExpanded] = useState(false);

    // Fetch conditionally
    const { data: cocktail, isLoading: loadingCocktail } = useCocktail(!isBeer && !isWine ? id : undefined);
    const { data: beer, isLoading: loadingBeer } = useBeer(isBeer ? safeId : "");
    const { data: wine, isLoading: loadingWine } = useWine(isWine ? safeId : "");

    const isLoading = loadingCocktail || loadingBeer || loadingWine;
    const item = isBeer ? beer : isWine ? wine : cocktail;

    if (isLoading) {
        return (
            <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="$background">
                <ActivityIndicator size="large" color={theme.color8?.get() as string} />
                <Text color="$color11" marginTop="$2">Loading details...</Text>
            </YStack>
        );
    }

    if (!item) {
        return (
            <YStack flex={1} justifyContent="center" alignItems="center" padding="$6" backgroundColor="$background">
                <IconSymbol name="wineglass" size={48} color={theme.color11?.get() as string} style={{ opacity: 0.3 }} />
                <Text color="$color11" fontSize={16} fontWeight="500" marginTop="$4" textAlign="center">
                    Select a drink to view recipe and details.
                </Text>
            </YStack>
        );
    }

    const images = item.item_images?.map((img: any) => img.images?.url).filter(Boolean) as string[] || [];
    if (images.length === 0) {
        images.push(require("@/assets/images/cocktails/house_martini.png"));
    }

    const itemFavId = id;
    const isFav = isFavorite(itemFavId);
    const isStudying = isInStudyPile(itemFavId);

    const onEditPress = canEdit ? () => {
        if (isBeer) router.push(`/beer/${safeId}/edit`);
        else if (isWine) router.push(`/wine/${safeId}/edit`);
        else router.push(`/cocktail/${id}/edit`);
    } : undefined;

    return (
        <YStack flex={1} backgroundColor="$background">
            {/* Header Area */}
            <XStack 
                paddingVertical="$4" 
                paddingHorizontal="$6" 
                borderBottomWidth={1} 
                borderBottomColor="$borderColor" 
                justifyContent="space-between" 
                alignItems="center"
                backgroundColor="$backgroundStrong"
            >
                <YStack flex={1} marginRight="$4">
                    <Text fontSize={24} fontWeight="bold" color="$color" numberOfLines={1}>
                        {item.name}
                    </Text>
                </YStack>
                
                <XStack alignItems="center" gap="$2">
                    <TouchableOpacity 
                        onPress={() => {
                            toggleFavorite(itemFavId);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        }} 
                        style={[styles.actionButton, { backgroundColor: isFav ? "rgba(255, 75, 75, 0.1)" : "rgba(255,255,255,0.05)" }]}
                    >
                        <IconSymbol name={isFav ? "heart.fill" : "heart"} size={18} color={isFav ? "#FF4B4B" : theme.color?.get() as string} />
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        onPress={() => {
                            toggleStudyPile(itemFavId);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        }} 
                        style={[styles.actionButton, { backgroundColor: isStudying ? "rgba(74, 144, 226, 0.1)" : "rgba(255,255,255,0.05)" }]}
                    >
                        <IconSymbol name={isStudying ? "book.fill" : "book"} size={18} color={isStudying ? "#4A90E2" : theme.color?.get() as string} />
                    </TouchableOpacity>
                    
                    {onEditPress && isEditModeEnabled && (
                        <TouchableOpacity 
                            onPress={onEditPress} 
                            style={[styles.actionButton, { backgroundColor: "rgba(255,255,255,0.05)" }]}
                        >
                            <IconSymbol name="ellipsis" size={18} color={theme.color?.get() as string} />
                        </TouchableOpacity>
                    )}
                </XStack>
            </XStack>

            <ScrollView flex={1} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                {/* Image Section */}
                <View style={styles.imageContainer}>
                    <ImageCarousel
                        images={images}
                        paginationBelow={true} 
                    />
                </View>

                {/* Cocktail Specific View (Badges & Ingredients) */}
                {!isBeer && !isWine && cocktail && (
                    <YStack gap="$4" marginTop="$4">
                        {/* Badges */}
                        <XStack flexWrap="wrap" gap="$4" paddingHorizontal={24} justifyContent="flex-start" alignItems="center">
                            {cocktail.item_methods?.[0]?.method?.name && (
                                <YStack alignItems="center" gap="$1" width={60}>
                                    <YStack height={26} justifyContent="flex-end" alignItems="center">
                                        <CustomIcon name={cocktail.item_methods[0].method.name} size={20} color={theme.color?.get() as string} />
                                    </YStack>
                                    <Text color="$color" fontSize={9} opacity={0.6} fontWeight="600" textAlign="center" textTransform="uppercase" letterSpacing={0.5} numberOfLines={1}>{cocktail.item_methods[0].method.name}</Text>
                                </YStack>
                            )}
                            {cocktail.glassware?.name && (
                                <YStack alignItems="center" gap="$1" width={60}>
                                    <YStack height={26} justifyContent="flex-end" alignItems="center">
                                        <CustomIcon name={cocktail.glassware.name} size={20} color={theme.color?.get() as string} />
                                    </YStack>
                                    <Text color="$color" fontSize={9} opacity={0.6} fontWeight="600" textAlign="center" textTransform="uppercase" letterSpacing={0.5} numberOfLines={1}>{cocktail.glassware.name}</Text>
                                </YStack>
                            )}
                            {cocktail.ice?.name && (
                                <YStack alignItems="center" gap="$1" width={60}>
                                    <YStack height={26} justifyContent="flex-end" alignItems="center">
                                        <CustomIcon name={cocktail.ice.name} size={20} color={theme.color?.get() as string} />
                                    </YStack>
                                    <Text color="$color" fontSize={9} opacity={0.6} fontWeight="600" textAlign="center" textTransform="uppercase" letterSpacing={0.5} numberOfLines={1}>{cocktail.ice.name}</Text>
                                </YStack>
                            )}
                            {cocktail.family?.name && (
                                <YStack alignItems="center" gap="$1" width={60}>
                                    <YStack height={26} justifyContent="flex-end" alignItems="center">
                                        <CustomIcon name={cocktail.family.name} size={20} color={theme.color?.get() as string} />
                                    </YStack>
                                    <Text color="$color" fontSize={9} opacity={0.6} fontWeight="600" textAlign="center" textTransform="uppercase" letterSpacing={0.5} numberOfLines={1}>{cocktail.family.name}</Text>
                                </YStack>
                            )}
                            {cocktail.origin && (
                                <YStack alignItems="center" gap="$1" width={60}>
                                    <YStack height={26} justifyContent="flex-end" alignItems="center">
                                        <CustomIcon name={cocktail.origin} size={20} color={theme.color?.get() as string} />
                                    </YStack>
                                    <Text color="$color" fontSize={9} opacity={0.6} fontWeight="600" textAlign="center" textTransform="uppercase" letterSpacing={0.5} numberOfLines={1}>{cocktail.origin}</Text>
                                </YStack>
                            )}
                        </XStack>

                        {/* Ingredients Title */}
                        <Text fontSize={18} fontWeight="bold" color="$color" paddingHorizontal={24} marginTop="$2">Ingredients</Text>

                        {/* Ingredients List */}
                        {cocktail.recipes && cocktail.recipes.length > 0 ? (
                            <YStack gap="$2" paddingHorizontal={24}>
                                {cocktail.recipes.map((recipe: any, index) => {
                                    const ingredientsData = recipe.ingredient;
                                    const imageUrl = ingredientsData?.item_images?.[0]?.images?.url;
                                    
                                    const measurementParts = [];
                                    if (recipe.amount) measurementParts.push(`${recipe.amount}`);
                                    if (recipe.unit) measurementParts.push(`${recipe.unit}`);
                                    const measurement = measurementParts.join(" ");

                                    const ingredientId = ingredientsData?.id || recipe.display_ingredient_id || recipe.ingredient_item_id;
                                    const isIngSelected = selectedIngredientId === ingredientId;

                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            activeOpacity={0.8}
                                            onPress={() => ingredientId && onIngredientPress?.(ingredientId)}
                                        >
                                            <Card 
                                                flexDirection="row" 
                                                alignItems="center" 
                                                padding="$3" 
                                                gap="$4"
                                                borderWidth={1}
                                                borderColor={isIngSelected ? "$color8" : "rgba(255,255,255,0.05)"}
                                                backgroundColor={isIngSelected ? "rgba(0,122,255,0.08)" : "$backgroundStrong"}
                                                borderRadius={12}
                                            >
                                                {imageUrl ? (
                                                    <Image 
                                                        source={imageUrl} 
                                                        style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)" }} 
                                                        contentFit="cover"
                                                    />
                                                ) : (
                                                    <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.05)", justifyContent: "center", alignItems: "center" }}>
                                                        <IconSymbol name="drop.fill" size={16} color={theme.color?.get() as string} style={{ opacity: 0.2 }} />
                                                    </View>
                                                )}
                                                <YStack flex={1} gap="$0.5">
                                                    {measurement ? (
                                                        <Text color={isIngSelected ? "$color8" : "$color"} fontSize={11} opacity={0.6} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                                                            {measurement}
                                                        </Text>
                                                    ) : null}
                                                    <Text color="$color" fontSize={16} fontWeight="500">
                                                        {ingredientsData?.name || "Unknown Ingredient"}
                                                    </Text>
                                                </YStack>
                                                {isIngSelected && (
                                                    <IconSymbol name="chevron.right" size={16} color={theme.color8?.get() as string} />
                                                )}
                                            </Card>
                                        </TouchableOpacity>
                                    );
                                })}
                            </YStack>
                        ) : (
                            <Text color="$color11" paddingHorizontal={24} fontStyle="italic">No ingredients listed.</Text>
                        )}
                    </YStack>
                )}

                {/* Beer Badges */}
                {isBeer && beer && (
                    <XStack flexWrap="wrap" gap="$2" paddingHorizontal={24} marginTop="$4">
                        {beer.style && (
                            <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius="$10">
                                <IconSymbol name="mug.fill" size={12} color={theme.color?.get() as string} />
                                <Text color="$color" fontSize={12} fontWeight="500">{beer.style}</Text>
                            </XStack>
                        )}
                        {beer.brewery && (
                            <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius="$10">
                                <IconSymbol name="building.2.fill" size={12} color={theme.color?.get() as string} />
                                <Text color="$color" fontSize={12} fontWeight="500">{beer.brewery}</Text>
                            </XStack>
                        )}
                        {beer.abv != null && (
                            <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius="$10">
                                <IconSymbol name="percent" size={12} color={theme.color?.get() as string} />
                                <Text color="$color" fontSize={12} fontWeight="500">{beer.abv}% ABV</Text>
                            </XStack>
                        )}
                        {beer.price != null && (
                            <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius="$10">
                                <IconSymbol name="dollarsign.circle.fill" size={12} color={theme.color?.get() as string} />
                                <Text color="$color" fontSize={12} fontWeight="500">${beer.price}</Text>
                            </XStack>
                        )}
                    </XStack>
                )}

                {/* Wine Badges */}
                {isWine && wine && (
                    <XStack flexWrap="wrap" gap="$2" paddingHorizontal={24} marginTop="$4">
                        {wine.style && (
                            <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius="$10">
                                <IconSymbol name="wineglass.fill" size={12} color={theme.color?.get() as string} />
                                <Text color="$color" fontSize={12} fontWeight="500">{wine.style}</Text>
                            </XStack>
                        )}
                        {wine.winery && (
                            <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius="$10">
                                <IconSymbol name="building.2.fill" size={12} color={theme.color?.get() as string} />
                                <Text color="$color" fontSize={12} fontWeight="500">{wine.winery}</Text>
                            </XStack>
                        )}
                        {wine.abv != null && (
                            <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius="$10">
                                <IconSymbol name="percent" size={12} color={theme.color?.get() as string} />
                                <Text color="$color" fontSize={12} fontWeight="500">{wine.abv}% ABV</Text>
                            </XStack>
                        )}
                        {wine.price != null && (
                            <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius="$10">
                                <IconSymbol name="dollarsign.circle.fill" size={12} color={theme.color?.get() as string} />
                                <Text color="$color" fontSize={12} fontWeight="500">${wine.price}</Text>
                            </XStack>
                        )}
                    </XStack>
                )}

                {/* Description & Notes */}
                {(item.description || item.notes) && (
                    <YStack gap="$3" paddingHorizontal={24} marginTop="$4">
                        {item.description && (
                            <Paragraph color="$color" fontSize={15} lineHeight={22} opacity={0.9}>
                                {item.description}
                            </Paragraph>
                        )}
                        
                        {item.notes && (
                            <TouchableOpacity 
                                style={[styles.notesToggle, { backgroundColor: theme.backgroundStrong?.get() as string, borderColor: theme.borderColor?.get() as string, borderWidth: 1 }]} 
                                onPress={() => setNotesExpanded(!notesExpanded)}
                                activeOpacity={0.7}
                            >
                                <XStack alignItems="center" gap="$2">
                                    <IconSymbol name="note.text" size={14} color={theme.color?.get() as string} style={{ opacity: 0.8 }} />
                                    <Text color="$color" fontSize={12} fontWeight="bold" textTransform="uppercase" letterSpacing={1}>Notes</Text>
                                    <View style={{ flex: 1 }} />
                                    <IconSymbol 
                                        name={notesExpanded ? "chevron.up" : "chevron.down"} 
                                        size={12} 
                                        color={theme.color?.get() as string} 
                                        style={{ opacity: 0.6 }}
                                    />
                                </XStack>
                                {notesExpanded && (
                                    <Paragraph color="$color" fontSize={15} lineHeight={22} marginTop="$3" opacity={0.85}>
                                        {item.notes}
                                    </Paragraph>
                                )}
                            </TouchableOpacity>
                        )}
                    </YStack>
                )}
            </ScrollView>
        </YStack>
    );
}

const styles = StyleSheet.create({
    actionButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
    },
    imageContainer: {
        width: "100%",
        height: 240,
        backgroundColor: "rgba(255,255,255,0.02)",
        overflow: "hidden",
    },
    notesToggle: {
        padding: 14,
        borderRadius: 10,
        width: "100%",
    },
});
