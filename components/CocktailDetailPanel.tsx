import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { Paragraph, ScrollView, Text, XStack, YStack, useTheme, Input } from "tamagui";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { CocktailDetailContent } from "@/components/cocktail/CocktailDetailContent";
import { useCocktail } from "@/hooks/useCocktails";
import { useBeer } from "@/hooks/useBeers";
import { useWine } from "@/hooks/useWines";
import { useFavorites } from "@/hooks/useFavorites";
import { useStudyPile } from "@/hooks/useStudyPile";
import { useBars } from "@/hooks/useBars";
import { useCocktailEditor } from "@/hooks/useCocktailEditor";
import { useAppStore } from "@/store/useAppStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { ImageCarousel } from "@/components/ImageCarousel";
import { capitalize, handleCapitalizedChange } from "@/lib/stringUtils";

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
    const isCocktail = !isBeer && !isWine;
    const [isEditing, setIsEditing] = useState(false);
    const [titleFocused, setTitleFocused] = useState(false);
    const isEditingCocktail = isCocktail && canEdit && isEditing;

    const [notesExpanded, setNotesExpanded] = useState(false);

    const { data: cocktail, isLoading: loadingCocktail } = useCocktail(isCocktail ? id : undefined);
    const { data: beer, isLoading: loadingBeer } = useBeer(isBeer ? safeId : "");
    const { data: wine, isLoading: loadingWine } = useWine(isWine ? safeId : "");
    const editor = useCocktailEditor(id, { enabled: isEditingCocktail });

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

    const panelImages = isEditingCocktail && editor.localImages.length > 0
        ? editor.localImages.map((img) => img.url)
        : item.item_images?.map((img: any) => img.images?.url).filter(Boolean) as string[] || [];

    const images = panelImages.length > 0
        ? panelImages
        : [require("@/assets/images/cocktails/house_martini.png")];

    const itemFavId = id;
    const isFav = isFavorite(itemFavId);
    const isStudying = isInStudyPile(itemFavId);

    const onEditPress = canEdit && !isCocktail ? () => {
        if (isBeer) router.push(`/beer/${safeId}/edit`);
        else router.push(`/wine/${safeId}/edit`);
    } : undefined;

    const displayName = isEditingCocktail ? editor.name : item.name;

    const handleSave = async () => {
        await editor.handleSave();
    };

    const handleCancelEdit = () => {
        editor.discardChanges();
        setIsEditing(false);
        setTitleFocused(false);
    };

    return (
        <YStack flex={1} backgroundColor="$background">
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
                    {isEditingCocktail && titleFocused ? (
                        <Input
                            value={editor.name}
                            onChangeText={(val) => handleCapitalizedChange(val, editor.name, editor.setName)}
                            onBlur={() => {
                                editor.setName(capitalize(editor.name));
                                setTitleFocused(false);
                            }}
                            unstyled
                            fontSize={24}
                            fontWeight="bold"
                            color="$color"
                            padding={0}
                            autoFocus
                        />
                    ) : isEditingCocktail ? (
                        <TouchableOpacity onPress={() => setTitleFocused(true)} activeOpacity={0.7}>
                            <Text fontSize={24} fontWeight="bold" color="$color" numberOfLines={1}>
                                {displayName}
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <Text fontSize={24} fontWeight="bold" color="$color" numberOfLines={1}>
                            {displayName}
                        </Text>
                    )}
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

                    {isEditingCocktail ? (
                        <XStack alignItems="center" gap="$2">
                            <TouchableOpacity
                                onPress={handleCancelEdit}
                                style={[styles.actionButton, { backgroundColor: "rgba(255,255,255,0.05)", width: 'auto', paddingHorizontal: 12 }]}
                            >
                                <Text color={theme.color11?.get() as string} fontWeight="600" fontSize={13}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSave}
                                disabled={editor.saving || !editor.isDirty}
                                style={[styles.actionButton, { backgroundColor: theme.color8?.get() as string, opacity: editor.isDirty ? 1 : 0.4, width: 'auto', paddingHorizontal: 14 }]}
                            >
                                <Text color={theme.backgroundStrong?.get() as string} fontWeight="bold" fontSize={13}>
                                    {editor.saving ? "…" : "Save"}
                                </Text>
                            </TouchableOpacity>
                        </XStack>
                    ) : canEdit && isCocktail ? (
                        <TouchableOpacity
                            onPress={() => setIsEditing(true)}
                            style={[styles.actionButton, { backgroundColor: theme.color8?.get() as string, width: 'auto', paddingHorizontal: 14 }]}
                        >
                            <Text color={theme.backgroundStrong?.get() as string} fontWeight="bold" fontSize={13}>Edit</Text>
                        </TouchableOpacity>
                    ) : (
                        onEditPress && isEditModeEnabled && (
                            <TouchableOpacity
                                onPress={onEditPress}
                                style={[styles.actionButton, { backgroundColor: "rgba(255,255,255,0.05)" }]}
                            >
                                <IconSymbol name="ellipsis" size={18} color={theme.color?.get() as string} />
                            </TouchableOpacity>
                        )
                    )}
                </XStack>
            </XStack>

            <ScrollView flex={1} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                <View style={styles.imageContainer}>
                    <ImageCarousel images={images} paginationBelow={true} />
                </View>

                {isCocktail && cocktail && (
                    <CocktailDetailContent
                        cocktail={cocktail}
                        isEditing={isEditingCocktail}
                        editor={isEditingCocktail ? editor : null}
                        onIngredientPress={onIngredientPress}
                        selectedIngredientId={selectedIngredientId}
                        variant="panel"
                    />
                )}

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
                    </XStack>
                )}

                {isWine && wine && (
                    <XStack flexWrap="wrap" gap="$2" paddingHorizontal={24} marginTop="$4">
                        {wine.style && (
                            <XStack alignItems="center" gap="$2" backgroundColor="$backgroundStrong" borderWidth={1} borderColor="$borderColor" paddingHorizontal="$3" paddingVertical="$1.5" borderRadius="$10">
                                <IconSymbol name="wineglass.fill" size={12} color={theme.color?.get() as string} />
                                <Text color="$color" fontSize={12} fontWeight="500">{wine.style}</Text>
                            </XStack>
                        )}
                    </XStack>
                )}

                {!isCocktail && (item.description || item.notes) && (
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
                                    <IconSymbol name={notesExpanded ? "chevron.up" : "chevron.down"} size={12} color={theme.color?.get() as string} style={{ opacity: 0.6 }} />
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
