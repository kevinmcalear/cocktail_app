import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { YStack, useTheme } from "tamagui";

import { SortableImageList } from "@/components/cocktail/SortableImageList";
import { CocktailDetailContent } from "@/components/cocktail/CocktailDetailContent";
import { ItemDetailLayout } from "@/components/ItemDetailLayout";
import { AdaptiveSheetModal } from "@/components/ui/AdaptiveSheetModal";
import { useCocktailDraftEditor } from "@/hooks/useCocktailDraftEditor";
import type { EditorChromeState } from "@/lib/editorChrome";
import { buildDraftCocktailView } from "@/lib/buildDraftCocktailView";
import { capitalize, handleCapitalizedChange } from "@/lib/stringUtils";

interface CocktailDraftInlineEditorProps {
    draftId?: string | null;
    barId?: string | null;
    menuDraftId?: string | null;
    menuSectionId?: string | null;
    initialName?: string | null;
    embedded?: boolean;
    onClose?: () => void;
    onSave?: () => void;
    onNestedItemPress?: (ingredientId: string) => void;
    onChromeState?: (state: EditorChromeState | null) => void;
}

export function CocktailDraftInlineEditor({
    draftId,
    barId,
    menuDraftId,
    menuSectionId,
    initialName,
    embedded = true,
    onClose,
    onSave,
    onNestedItemPress,
    onChromeState,
}: CocktailDraftInlineEditorProps) {
    const theme = useTheme();
    const editor = useCocktailDraftEditor({
        draftId,
        barId,
        menuDraftId,
        menuSectionId,
        initialName,
        enabled: true,
    });
    const [showPhotoSheet, setShowPhotoSheet] = useState(false);

    const handleSaveDraft = async () => {
        const id = await editor.handleSaveDraft(false);
        if (id) setShowPhotoSheet(false);
        return id;
    };

    const handlePublish = async () => {
        const ok = await editor.handlePublish();
        if (ok) {
            setShowPhotoSheet(false);
            onSave?.();
        }
        return ok;
    };

    const handleDelete = async () => {
        const ok = await editor.handleDelete();
        if (ok) {
            setShowPhotoSheet(false);
            onClose?.();
        }
        return ok;
    };

    const handleClose = () => {
        editor.discardChanges();
        setShowPhotoSheet(false);
        onClose?.();
    };

    useEffect(() => {
        if (!onChromeState || editor.loading) return;
        onChromeState({
            save: async () => {
                await handleSaveDraft();
            },
            publish: async () => {
                await handlePublish();
            },
            discard: () => {
                void handleDelete();
            },
            cancel: handleClose,
            saving: editor.saving,
            isDirty: editor.isDirty,
            canPublish: Boolean(editor.name.trim()),
        });
        return () => onChromeState(null);
    }, [onChromeState, editor.loading, editor.saving, editor.isDirty, editor.name, editor.draftId]);

    const cocktailView = useMemo(
        () =>
            buildDraftCocktailView(
                {
                    name: editor.name,
                    description: editor.description,
                    origin: editor.origin,
                    notes: editor.notes,
                    methodId: editor.methodId,
                    glasswareId: editor.glasswareId,
                    familyId: editor.familyId,
                    iceId: editor.iceId,
                    methods: editor.methods,
                    glassware: editor.glassware,
                    families: editor.families,
                    iceTypes: editor.iceTypes,
                    recipeItems: editor.recipeItems,
                },
                editor.draftId
            ),
        [editor]
    );

    if (editor.loading) {
        return (
            <YStack flex={1} justifyContent="center" alignItems="center">
                <ActivityIndicator size="large" color={theme.color?.get() as string} />
            </YStack>
        );
    }

    const displayImages = editor.localImages.map((img) => img.url);

    return (
        <>
            <ItemDetailLayout
                id={editor.draftId || "new-draft"}
                title={editor.name || ""}
                images={displayImages}
                emptyPhotoPlaceholder={displayImages.length === 0}
                isFavorite={false}
                isInStudyPile={false}
                onToggleFavorite={() => {}}
                onToggleStudyPile={() => {}}
                embedded={embedded}
                isEditing
                onBack={embedded ? undefined : handleClose}
                onCancelEdit={embedded ? undefined : handleClose}
                onSave={embedded ? undefined : () => { void handleSaveDraft(); }}
                onPublish={embedded ? undefined : () => { void handlePublish(); }}
                onDelete={embedded ? undefined : () => { void handleDelete(); }}
                saving={editor.saving}
                isDirty={editor.isDirty}
                canPublish={Boolean(editor.name.trim())}
                editableTitle={{
                    value: editor.name,
                    onChange: (val) => handleCapitalizedChange(val, editor.name, editor.setName),
                    onBlur: () => editor.setName(capitalize(editor.name)),
                }}
                onManageImages={
                    Platform.OS === "web" && displayImages.length === 0
                        ? () => { void editor.pickImage(); }
                        : () => setShowPhotoSheet(true)
                }
                onDropImages={editor.addImages}
            >
                <CocktailDetailContent
                    cocktail={cocktailView}
                    isEditing
                    editor={editor}
                    onNestedItemPress={onNestedItemPress}
                />
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
