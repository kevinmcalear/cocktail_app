import { ErrorState } from '@/components/ui/ErrorState';
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Text, YStack } from "tamagui";

import { SortableImageList } from "@/components/cocktail/SortableImageList";
import { CocktailDetailContent } from "@/components/cocktail/CocktailDetailContent";
import { SketchGlassPicker } from "@/components/cocktail/SketchGlassPicker";
import { ItemDetailLayout } from "@/components/ItemDetailLayout";
import { AdaptiveSheetModal } from "@/components/ui/AdaptiveSheetModal";
import { useCocktail, useDeleteCocktail } from "@/hooks/useCocktails";
import { useCocktailEditor } from "@/hooks/useCocktailEditor";
import { useFavorites } from "@/hooks/useFavorites";
import { useStudyPile } from "@/hooks/useStudyPile";
import { recentEntry, useTrackRecent } from "@/hooks/useTrackRecent";
import { useCanEditItem } from "@/hooks/useViewAs";
import { confirmAsync } from "@/lib/dialogs";
import { heroPicture, orderedPictures, pictureTag } from "@/lib/itemImages";
import { capitalize, handleCapitalizedChange } from "@/lib/stringUtils";
import { DrinkLoading, DrinkScreen } from "@/components/screens/drink/DrinkScreen";
import { ShotList } from "@/components/screens/drink/ShotList";

// For /dev/drink, which loads it through this route so the web build reuses this
// route's chunk instead of putting the whole drink page in the shared one.
export { DrinkScreen };
export { BatchSheet } from "@/components/screens/batch/BatchSheet";

export default function CocktailDetailsScreen() {
    const { id, batch } = useLocalSearchParams<{ id: string; batch?: string }>();

    const { isFavorite, toggleFavorite } = useFavorites();
    const { toggleStudyPile, isInStudyPile } = useStudyPile();

    // isPending, not isLoading: "no data yet" includes the static prerender and the
    // first paint, when nothing is fetching, and those must not read as not found.
    // A placeholder (the tapped row's name and picture) paints the hero only: the rest waits for the drink.
    const query = useCocktail(id as string, { seeded: true });
    const { error, refetch } = query;
    const isLoading = query.isPending || query.isPlaceholderData;
    const cocktail = query.isPlaceholderData ? undefined : query.data;

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

    const router = useRouter();
    const deleteCocktail = useDeleteCocktail();
    const handleDelete = async () => {
        if (!cocktail) return;
        const ok = await confirmAsync({
            title: `Delete ${cocktail.name}?`,
            message: "This removes the drink, its spec and its photos for everyone at the venue. It can't be undone.",
            confirmText: "Delete",
            destructive: true,
        });
        if (!ok) return;
        try {
            await deleteCocktail.mutateAsync(cocktail.id);
        } catch {
            return; // the global mutation handler shows the error
        }
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)");
    };

    const handleCancelEdit = () => {
        editor.discardChanges();
        setIsEditing(false);
        setShowPhotoSheet(false);
    };

    // Not yours to read (another bar's drink): its public page, if it's published.
    if ((error as { code?: string } | null)?.code === "PGRST116") return <Redirect href={`/d/${id}`} />;
    // The drink page is the read view; editing still uses the editor below.
    if (!isEditing && !error) {
        return cocktail ? (
            <DrinkScreen
                item={cocktail}
                isFavorite={isFavorite(cocktail.id)}
                onToggleFavorite={() => toggleFavorite(cocktail.id)}
                inStudyPile={isInStudyPile(cocktail.id)}
                onToggleStudyPile={() => toggleStudyPile(cocktail.id)}
                canEdit={canEdit}
                onEdit={() => setIsEditing(true)}
                openBatch={batch === "1"}
                sheet
            />
        ) : (
            <DrinkLoading seed={query.isPlaceholderData ? query.data : null} />
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
                onToggleFavorite={() => {}}
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
                onToggleFavorite={toggleFavorite}
                canEdit={canEdit}
                onStartEdit={() => setIsEditing(true)}
                onCancelEdit={handleCancelEdit}
                isEditing={isEditing}
                onSave={isEditing ? handleSave : undefined}
                onDelete={isEditing && canEdit ? () => void handleDelete() : undefined}
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
                {isEditing ? (
                    <View style={styles.servicePhotos}>
                        <ShotList itemId={cocktail.id} barId={cocktail.bar_id ?? null} links={cocktail.item_images} />
                        <SketchGlassPicker
                            itemId={cocktail.id}
                            barId={editor.barId}
                            glasswareName={editor.glassware.find((g) => g.id === editor.glasswareId)?.name ?? null}
                            value={editor.sketchVariant}
                            onChange={editor.setSketchVariant}
                        />
                    </View>
                ) : null}
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
    servicePhotos: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },
});
