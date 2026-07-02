import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text, YStack } from "tamagui";

import { SortableImageList } from "@/components/cocktail/SortableImageList";
import { CocktailDetailContent } from "@/components/cocktail/CocktailDetailContent";
import { GenerateImageButton } from "@/components/GenerateImageButton";
import { ItemDetailLayout } from "@/components/ItemDetailLayout";
import { AdaptiveSheetModal } from "@/components/ui/AdaptiveSheetModal";
import { useBars } from "@/hooks/useBars";
import { useCocktail } from "@/hooks/useCocktails";
import { useCocktailEditor } from "@/hooks/useCocktailEditor";
import { useFavorites } from "@/hooks/useFavorites";
import { useStudyPile } from "@/hooks/useStudyPile";
import { capitalize, handleCapitalizedChange } from "@/lib/stringUtils";
import { useAppStore } from "@/store/useAppStore";

export default function CocktailDetailsScreen() {
    const { id } = useLocalSearchParams();

    const { isFavorite, toggleFavorite } = useFavorites();
    const { toggleStudyPile, isInStudyPile } = useStudyPile();

    const { data: cocktail, isLoading, error } = useCocktail(id as string);

    const selectedBarId = useAppStore((state) => state.selectedBarId);
    const { data: bars } = useBars();
    const currentBarRole = bars?.find((b) => b.bar_id === selectedBarId)?.role_level || 10;
    const canEdit = currentBarRole > 30;
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
                            <Text color="$red10" fontSize={18} fontWeight="bold" marginBottom="$2">
                                Error Loading Cocktail
                            </Text>
                            <Text color="$red9" fontSize={14}>
                                {error instanceof Error ? error.message : JSON.stringify(error)}
                            </Text>
                        </>
                    ) : (
                        <Text>{isLoading ? "Loading..." : "Cocktail not found."}</Text>
                    )}
                </YStack>
            </ItemDetailLayout>
        );
    }

    const displayImages = isEditing && editor.localImages.length > 0
        ? editor.localImages.map((img) => img.url)
        : cocktail.item_images?.map((img) => img.images?.url).filter(Boolean) as string[] || [];

    const images = displayImages.length > 0
        ? displayImages
        : [require("@/assets/images/cocktails/house_martini.png")];

    const displayTitle = isEditing ? editor.name : cocktail.name;

    return (
        <>
            <ItemDetailLayout
                id={cocktail.id}
                title={displayTitle}
                images={images}
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
                onManageImages={isEditing ? () => setShowPhotoSheet(true) : undefined}
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
