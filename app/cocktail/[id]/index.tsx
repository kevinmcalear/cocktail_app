import { ErrorState } from '@/components/ui/ErrorState';
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Text, YStack } from "tamagui";

import { SortableImageList } from "@/components/cocktail/SortableImageList";
import { CocktailDetailContent } from "@/components/cocktail/CocktailDetailContent";
import { GenerateImageButton } from "@/components/GenerateImageButton";
import { ItemDetailLayout } from "@/components/ItemDetailLayout";
import { AdaptiveSheetModal } from "@/components/ui/AdaptiveSheetModal";
import { useCocktail } from "@/hooks/useCocktails";
import { useCocktailEditor } from "@/hooks/useCocktailEditor";
import { useFavorites } from "@/hooks/useFavorites";
import { useStudyPile } from "@/hooks/useStudyPile";
import { recentEntry, useTrackRecent } from "@/hooks/useTrackRecent";
import { useCanEditItem } from "@/hooks/useViewAs";
import { heroPicture, orderedPictures, pictureTag } from "@/lib/itemImages";
import { capitalize, handleCapitalizedChange } from "@/lib/stringUtils";
import { useRedesign } from "@/lib/flags";
import { DrinkLoading, DrinkScreen } from "@/components/screens/drink/DrinkScreen";

export default function CocktailDetailsScreen() {
    const { id } = useLocalSearchParams();

    const { isFavorite, toggleFavorite } = useFavorites();
    const { toggleStudyPile, isInStudyPile } = useStudyPile();

    const { data: cocktail, isLoading, error, refetch } = useCocktail(id as string);

    useTrackRecent(
        !!cocktail,
        cocktail
            ? recentEntry('cocktail', cocktail.id, cocktail.name, {
                imageUrl: heroPicture(cocktail.item_images)?.url,
                barId: cocktail.bar_id ?? null,
              })
            : null
    );

    const canEdit = useCanEditItem(cocktail);
    const [isEditing, setIsEditing] = useState(false);

    const editor = useCocktailEditor(id as string, { enabled: isEditing });
    const [showPhotoSheet, setShowPhotoSheet] = useState(false);

    const handleSave = async () => {
        const ok = await editor.handleSave();
        if (ok) setShowPhotoSheet(false);
    };

    const handleCancelEdit = () => {
        editor.discardChanges();
        setIsEditing(false);
        setShowPhotoSheet(false);
    };

    const redesign = useRedesign();
    // The redesign replaces the read view; editing still uses the editor below.
    if (redesign && !isEditing && !error) {
        return cocktail ? (
            <DrinkScreen
                item={cocktail}
                isFavorite={isFavorite(cocktail.id)}
                onToggleFavorite={() => toggleFavorite(cocktail.id)}
                inStudyPile={isInStudyPile(cocktail.id)}
                onToggleStudyPile={() => toggleStudyPile(cocktail.id)}
                canEdit={canEdit}
                onEdit={() => setIsEditing(true)}
            />
        ) : (
            <DrinkLoading />
        );
    }

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
                        <ErrorState title="Couldn't load this cocktail" onRetry={() => void refetch()} />
                    ) : (
                        <Text>{isLoading ? "Loading..." : "Cocktail not found."}</Text>
                    )}
                </YStack>
            </ItemDetailLayout>
        );
    }

    const pictures = orderedPictures(cocktail.item_images);
    const editingImages = isEditing && editor.localImages.length > 0;
    const images = editingImages ? editor.localImages.map((img) => img.url) : pictures.map((p) => p.url);
    const imageTags = editingImages ? undefined : pictures.map(pictureTag);

    const displayTitle = isEditing ? editor.name : cocktail.name;

    return (
        <>
            <ItemDetailLayout
                id={cocktail.id}
                title={displayTitle}
                images={images}
                imageTags={imageTags}
                emptyPhotoPlaceholder={isEditing && images.length === 0}
                isFavorite={isFavorite(cocktail.id)}
                isInStudyPile={isInStudyPile(cocktail.id)}
                onToggleFavorite={toggleFavorite}
                onToggleStudyPile={toggleStudyPile}
                canEdit={canEdit}
                onStartEdit={() => setIsEditing(true)}
                onCancelEdit={handleCancelEdit}
                isEditing={isEditing}
                onSave={isEditing ? handleSave : undefined}
                saving={editor.saving}
                isDirty={editor.isDirty}
                editableTitle={
                    isEditing
                        ? {
                              value: editor.name,
                              onChange: (val) => handleCapitalizedChange(val, editor.name, editor.setName),
                              onBlur: () => editor.setName(capitalize(editor.name)),
                          }
                        : undefined
                }
                onManageImages={
                    isEditing
                        ? Platform.OS === "web" && images.length === 0
                            ? () => { void editor.pickImage(); }
                            : () => setShowPhotoSheet(true)
                        : undefined
                }
                onDropImages={isEditing ? editor.addImages : undefined}
            >
                <CocktailDetailContent cocktail={cocktail} isEditing={isEditing} editor={isEditing ? editor : null} />
            </ItemDetailLayout>

            <AdaptiveSheetModal
                visible={showPhotoSheet}
                onClose={() => setShowPhotoSheet(false)}
                title="Photos"
            >
                <View style={{ paddingHorizontal: 24 }}>
                    <SortableImageList
                        images={editor.localImages}
                        onReorder={editor.setLocalImages}
                        onRemove={(index) =>
                            editor.setLocalImages(editor.localImages.filter((_, i) => i !== index))
                        }
                        onAdd={editor.pickImage}
                        onAddUris={editor.addImages}
                        generateComponent={
                            <GenerateImageButton type="cocktail" id={id as string} variant="tile" />
                        }
                    />
                </View>
            </AdaptiveSheetModal>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
    },
});
