import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Text, YStack } from "tamagui";

import { CocktailDetailContent } from "@/components/cocktail/CocktailDetailContent";
import { SketchGlassPicker } from "@/components/cocktail/SketchGlassPicker";
import { SortableImageList } from "@/components/cocktail/SortableImageList";
import { ItemDetailLayout } from "@/components/ItemDetailLayout";
import { ShotList } from "@/components/screens/drink/ShotList";
import { SketchColour } from "@/components/screens/drink/SketchColour";
import { AdaptiveSheetModal } from "@/components/ui/AdaptiveSheetModal";
import { ErrorState } from "@/components/ui/ErrorState";
import { useCocktail, useDeleteCocktail } from "@/hooks/useCocktails";
import { useCocktailEditor } from "@/hooks/useCocktailEditor";
import { useCanEditItem } from "@/hooks/useViewAs";
import { confirmAsync } from "@/lib/dialogs";
import { orderedPictures, pictureTag } from "@/lib/itemImages";
import { capitalize, handleCapitalizedChange } from "@/lib/stringUtils";

/**
 * The legacy cocktail editor (and the page's error state), split from the
 * drink route so the read view doesn't load it: the route lazy-loads it when
 * someone edits, which keeps its gesture and animation code off the web's
 * first load.
 */
export function CocktailEditor({ id, isEditing, setIsEditing }: { id: string; isEditing: boolean; setIsEditing: (editing: boolean) => void }) {
    const query = useCocktail(id, { seeded: true });
    // isPending, not isLoading: "no data yet" includes the static prerender and the
    // first paint, when nothing is fetching, and those must not read as not found.
    const { error, refetch } = query;
    const isLoading = query.isPending || query.isPlaceholderData;
    const cocktail = query.isPlaceholderData ? undefined : query.data;
    const canEdit = useCanEditItem(cocktail);
    // A drink credited to a bar: its staff edit it, but it stays shared
    // (others rank and save it), so only SQL deletes it.
    // ponytail: catalog admins lose the button here too; give them a can_delete RPC if they need it.
    const credited = !!cocktail && !cocktail.bar_id && !cocktail.created_by && !!cocktail.origin_bar_profile_id;

    const editor = useCocktailEditor(id, { enabled: isEditing });
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

    if (isLoading || error || !cocktail) {
        return (
            <ItemDetailLayout
                id={id}
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
                isFavorite={false}
                onToggleFavorite={() => {}}
                canEdit={canEdit}
                onStartEdit={() => setIsEditing(true)}
                onCancelEdit={handleCancelEdit}
                isEditing={isEditing}
                onSave={isEditing ? handleSave : undefined}
                onDelete={isEditing && canEdit && !credited ? () => void handleDelete() : undefined}
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
                        <SketchColour itemId={cocktail.id} />
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
