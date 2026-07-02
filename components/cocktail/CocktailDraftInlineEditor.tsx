import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, View } from "react-native";
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

    const handleSave = async () => {
        const ok = await editor.handleSave();
        if (ok) {
            setShowPhotoSheet(false);
            onSave?.();
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
        const canPublish = Boolean(editor.name.trim()) || editor.isDirty;
        onChromeState({
            save: async () => {
                await handleSave();
            },
            cancel: handleClose,
            saving: editor.saving,
            isDirty: canPublish,
        });
        return () => onChromeState(null);
    }, [onChromeState, editor.loading, editor.saving, editor.isDirty, editor.name]);

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
                editableTitle={{
                    value: editor.name,
                    onChange: (val) => handleCapitalizedChange(val, editor.name, editor.setName),
                    onBlur: () => editor.setName(capitalize(editor.name)),
                }}
                onManageImages={() => setShowPhotoSheet(true)}
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
                    />
                </View>
            </AdaptiveSheetModal>
        </>
    );
}
