import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Paragraph, Text, XStack, YStack, useTheme } from "tamagui";

import { ItemDetailLayout } from "@/components/ItemDetailLayout";
import { CustomIcon } from "@/components/ui/CustomIcons";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useCocktail } from "@/hooks/useCocktails";
import { useFavorites } from "@/hooks/useFavorites";
import { useStudyPile } from "@/hooks/useStudyPile";

export default function CocktailDetailsScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const theme = useTheme();

    const { isFavorite, toggleFavorite } = useFavorites();
    const { toggleStudyPile, isInStudyPile } = useStudyPile();

    const { data: cocktail, isLoading, error } = useCocktail(id as string);
    const [notesExpanded, setNotesExpanded] = useState(false);

    // Provide default layout if cocktail mapping fails safely
    if (isLoading || error || !cocktail) {
        return (
            <ItemDetailLayout 
                id={id as string}
                title={isLoading ? "Loading..." : "Not Found"}
                images={[]}
                isLoading={isLoading}
                isFavorite={false}
                isInStudyPile={false}
                onToggleFavorite={() => {}}
                onToggleStudyPile={() => {}}
            >
                <YStack style={styles.container}>
                    {error ? (
                        <>
                            <Text color="$red10" fontSize={18} fontWeight="bold" marginBottom="$2">Error Loading Cocktail</Text>
                            <Text color="$red9" fontSize={14}>{error instanceof Error ? error.message : JSON.stringify(error)}</Text>
                        </>
                    ) : (
                        <Text>{isLoading ? "Loading..." : "Cocktail not found."}</Text>
                    )}
                </YStack>
            </ItemDetailLayout>
        );
    }

    const images = cocktail.item_images?.map(img => img.images?.url).filter(Boolean) as string[] || [];
    if (images.length === 0) {
        images.push(require('@/assets/images/cocktails/house_martini.png'));
    }

    return (
        <ItemDetailLayout
            id={cocktail.id}
            title={cocktail.name}
            images={images}
            isFavorite={isFavorite(cocktail.id)}
            isInStudyPile={isInStudyPile(cocktail.id)}
            onToggleFavorite={toggleFavorite}
            onToggleStudyPile={toggleStudyPile}
            onEditPress={() => router.push(`/cocktail/${id}/edit`)}
        >
            {/* Core Metadata Badges */}
            <XStack flexWrap="wrap" gap="$5" paddingHorizontal={24} marginBottom="$6" marginTop="$2" justifyContent="flex-start" alignItems="flex-start">
                {cocktail.item_methods?.[0]?.method?.name && (
                    <YStack alignItems="center" gap="$1" justifyContent="flex-start">
                        <YStack height={26} justifyContent="flex-end" alignItems="center">
                            <CustomIcon name={cocktail.item_methods[0].method.name} size={24} color={theme.color?.get() as string} />
                        </YStack>
                        <Text color="$color" fontSize={9} opacity={0.6} fontWeight="600" textAlign="center" textTransform="uppercase" letterSpacing={0.5}>{cocktail.item_methods[0].method.name}</Text>
                    </YStack>
                )}
                {cocktail.glassware?.name && (
                    <YStack alignItems="center" gap="$1" justifyContent="flex-start">
                        <YStack height={26} justifyContent="flex-end" alignItems="center">
                            <CustomIcon name={cocktail.glassware.name} size={24} color={theme.color?.get() as string} />
                        </YStack>
                        <Text color="$color" fontSize={9} opacity={0.6} fontWeight="600" textAlign="center" textTransform="uppercase" letterSpacing={0.5}>{cocktail.glassware.name}</Text>
                    </YStack>
                )}
                {cocktail.ice?.name && (
                    <YStack alignItems="center" gap="$1" justifyContent="flex-start">
                        <YStack height={26} justifyContent="flex-end" alignItems="center">
                            <CustomIcon name={cocktail.ice.name} size={24} color={theme.color?.get() as string} />
                        </YStack>
                        <Text color="$color" fontSize={9} opacity={0.6} fontWeight="600" textAlign="center" textTransform="uppercase" letterSpacing={0.5}>{cocktail.ice.name}</Text>
                    </YStack>
                )}
                {cocktail.family?.name && (
                    <YStack alignItems="center" gap="$1" justifyContent="flex-start">
                        <YStack height={26} justifyContent="flex-end" alignItems="center">
                            <CustomIcon name={cocktail.family.name} size={24} color={theme.color?.get() as string} />
                        </YStack>
                        <Text color="$color" fontSize={9} opacity={0.6} fontWeight="600" textAlign="center" textTransform="uppercase" letterSpacing={0.5}>{cocktail.family.name}</Text>
                    </YStack>
                )}
                {cocktail.origin && (
                    <YStack alignItems="center" gap="$1" justifyContent="flex-start">
                        <YStack height={26} justifyContent="flex-end" alignItems="center">
                            <CustomIcon name={cocktail.origin} size={24} color={theme.color?.get() as string} />
                        </YStack>
                        <Text color="$color" fontSize={9} opacity={0.6} fontWeight="600" textAlign="center" textTransform="uppercase" letterSpacing={0.5}>{cocktail.origin}</Text>
                    </YStack>
                )}
            </XStack>



            {/* Ingredients List */}
            {cocktail.recipes && cocktail.recipes.length > 0 && (
                <YStack gap="$4" marginBottom="$6" paddingHorizontal={24}>
                    {cocktail.recipes.map((recipe, index) => {
                        const ingredientsData = recipe.ingredient;
                        const imageUrl = ingredientsData?.item_images?.[0]?.images?.url;
                        
                        // Extract measurement parts
                        const measurementParts = [];
                        if (recipe.amount) measurementParts.push(`${recipe.amount}`);
                        if (recipe.unit) measurementParts.push(`${recipe.unit}`);
                        const measurement = measurementParts.join(' ');

                        return (
                            <XStack key={index} alignItems="center" gap="$4">
                                <TouchableOpacity 
                                    onPress={() => ingredientsData?.name && router.push(`/ingredient/${ingredientsData.id}`)}
                                    activeOpacity={0.7}
                                >
                                    {imageUrl ? (
                                        <Image 
                                            source={imageUrl} 
                                            style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)' }} 
                                            contentFit="cover"
                                        />
                                    ) : (
                                        <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' }}>
                                            <IconSymbol name="drop.fill" size={24} color={theme.color?.get() as string} style={{ opacity: 0.2 }} />
                                        </View>
                                    )}
                                </TouchableOpacity>
                                <YStack flex={1} gap="$0.5">
                                    {measurement ? (
                                        <Text color="$color" fontSize={13} opacity={0.5} fontWeight="600" textTransform="uppercase" letterSpacing={0.5}>
                                            {measurement}
                                        </Text>
                                    ) : null}
                                    <TouchableOpacity 
                                        onPress={() => ingredientsData?.name && router.push(`/ingredient/${ingredientsData.id}`)}
                                        activeOpacity={0.7}
                                    >
                                        <Text color="$color" fontSize={18} fontWeight="400">
                                            {ingredientsData?.name || 'Unknown Ingredient'}
                                        </Text>
                                    </TouchableOpacity>
                                </YStack>
                            </XStack>
                        );
                    })}
                </YStack>
            )}

            {/* Description and Notes */}
            {(cocktail.description || cocktail.notes) && (
                <YStack gap="$3" paddingHorizontal="$4" marginBottom="$4">
                    {cocktail.description && (
                        <Paragraph color="$color" fontSize={16} lineHeight={24}>
                            {cocktail.description}
                        </Paragraph>
                    )}
                    {cocktail.notes && (
                        <TouchableOpacity 
                            style={[styles.notesToggle, { backgroundColor: theme.backgroundStrong?.get() as string, borderColor: theme.borderColor?.get() as string, borderWidth: 1 }]} 
                            onPress={() => setNotesExpanded(!notesExpanded)}
                            activeOpacity={0.7}
                        >
                            <XStack alignItems="center" gap="$2">
                                <IconSymbol name="note.text" size={16} color={theme.color?.get() as string} style={{ opacity: 0.8 }} />
                                <Text color="$color" fontSize={14} fontWeight="bold" textTransform="uppercase" letterSpacing={1}>Notes</Text>
                                <View style={{ flex: 1 }} />
                                <IconSymbol 
                                    name={notesExpanded ? "chevron.up" : "chevron.down"} 
                                    size={14} 
                                    color={theme.color?.get() as string} 
                                    style={{ opacity: 0.6 }}
                                />
                            </XStack>
                            {notesExpanded && (
                                <Paragraph color="$color" fontSize={16} lineHeight={24} marginTop="$3" opacity={0.9}>
                                    {cocktail.notes}
                                </Paragraph>
                            )}
                        </TouchableOpacity>
                    )}
                </YStack>
            )}
        </ItemDetailLayout>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
    },
    notesToggle: {
        padding: 16,
        borderRadius: 12,
        width: '100%',
    },
});
