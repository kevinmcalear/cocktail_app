import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Paragraph, Text, XStack, YStack, useTheme } from "tamagui";

import { ItemDetailLayout } from "@/components/ItemDetailLayout";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useFavorites } from "@/hooks/useFavorites";
import { useStudyPile } from "@/hooks/useStudyPile";
import { useWine } from "@/hooks/useWines";

export default function WineDetailsScreen() {
    const { id } = useLocalSearchParams();
    // In case the ID was passed as "wine-1234", strip the prefix
    const safeId = (id as string)?.replace('wine-', '');
    
    const router = useRouter();
    const theme = useTheme();

    const { isFavorite, toggleFavorite } = useFavorites();
    const { toggleStudyPile, isInStudyPile } = useStudyPile();

    const { data: wine, isLoading } = useWine(safeId);
    
    const [notesExpanded, setNotesExpanded] = useState(false);

    if (isLoading || !wine) {
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
                <YStack style={styles.container} justifyContent="center" alignItems="center">
                    <Text color="$color">{isLoading ? "Loading Wine..." : "Wine not found."}</Text>
                </YStack>
            </ItemDetailLayout>
        );
    }

    const images = wine.wine_images?.map((img: any) => img.images.url).filter(Boolean) as string[] || [];
    if (images.length === 0) {
        images.push(require('@/assets/images/cocktails/house_martini.png'));
    }

    return (
        <ItemDetailLayout
            id={`wine-${wine.id}`}
            title={wine.name}
            images={images}
            isFavorite={isFavorite(`wine-${wine.id}`)}
            isInStudyPile={isInStudyPile(`wine-${wine.id}`)}
            onToggleFavorite={toggleFavorite}
            onToggleStudyPile={toggleStudyPile}
            onEditPress={() => router.push(`/wine/${id}/edit`)}
        >
            {/* Core Metadata Badges */}
            <XStack flexWrap="wrap" gap="$2" paddingHorizontal="$4" marginBottom="$4">
                {wine.varietal && (
                    <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$2" borderRadius="$10">
                        <IconSymbol name="drop.fill" size={16} color={theme.color?.get() as string} />
                        <Text color="$color" fontSize={14} fontWeight="500">{wine.varietal}</Text>
                    </XStack>
                )}
                {wine.region && (
                    <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$2" borderRadius="$10">
                        <IconSymbol name="map.fill" size={16} color={theme.color?.get() as string} />
                        <Text color="$color" fontSize={14} fontWeight="500">{wine.region}</Text>
                    </XStack>
                )}
                {wine.location && (
                    <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$2" borderRadius="$10">
                        <IconSymbol name="mappin.and.ellipse" size={16} color={theme.color?.get() as string} />
                        <Text color="$color" fontSize={14} fontWeight="500">{wine.location}</Text>
                    </XStack>
                )}
                {wine.abv && (
                    <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$2" borderRadius="$10">
                        <IconSymbol name="percent" size={16} color={theme.color?.get() as string} />
                        <Text color="$color" fontSize={14} fontWeight="500">{wine.abv}% ABV</Text>
                    </XStack>
                )}
                {wine.price && (
                    <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$2" borderRadius="$10">
                        <IconSymbol name="dollarsign.circle.fill" size={16} color={theme.color?.get() as string} />
                        <Text color="$color" fontSize={14} fontWeight="500">${wine.price}</Text>
                    </XStack>
                )}
            </XStack>

            {/* Description and Notes */}
            {(wine.description || wine.notes) && (
                <YStack gap="$3" paddingHorizontal="$4" marginBottom="$4">
                    {wine.description && (
                        <Paragraph color="$color" fontSize={16} lineHeight={24}>
                            {wine.description}
                        </Paragraph>
                    )}
                    {wine.notes && (
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
                                    {wine.notes}
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
    },
    notesToggle: {
        padding: 16,
        borderRadius: 12,
        width: '100%',
    },
});
