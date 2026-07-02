import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { YStack, useTheme } from "tamagui";

import { SortableImageList } from "@/components/cocktail/SortableImageList";
import { CocktailDetailContent } from "@/components/cocktail/CocktailDetailContent";
import { GenerateImageButton } from "@/components/GenerateImageButton";
import { ItemDetailLayout } from "@/components/ItemDetailLayout";
import { AdaptiveSheetModal } from "@/components/ui/AdaptiveSheetModal";
import { useCocktail } from "@/hooks/useCocktails";
import { useCocktailEditor } from "@/hooks/useCocktailEditor";
import type { EditorChromeState } from "@/lib/editorChrome";
import { capitalize, handleCapitalizedChange } from "@/lib/stringUtils";

interface CocktailInlineEditorProps {
    id: string;
    embedded?: boolean;
    onClose?: () => void;
    onSave?: () => void;
    onNestedItemPress?: (ingredientId: string) => void;
    onChromeState?: (state: EditorChromeState | null) => void;
}

export function CocktailInlineEditor({
    id,
    embedded = true,
    onClose,
    onSave,
    onNestedItemPress,
    onChromeState,
}: CocktailInlineEditorProps) {
    const theme = useTheme();
    const { data: cocktail, isLoading } = useCocktail(id);
    const editor = useCocktailEditor(id, { enabled: true });
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
        onChromeState({
            save: handleSave,
            cancel: handleClose,
            saving: editor.saving,
            isDirty: editor.isDirty,
        });
        return () => onChromeState(null);
    }, [onChromeState, editor.loading, editor.saving, editor.isDirty]);

    if (isLoading || !cocktail || editor.loading) {
        return (
            <YStack flex={1} justifyContent="center" alignItems="center">
                <ActivityIndicator size="large" color={theme.color?.get() as string} />
            </YStack>
        );
    }

    const displayImages =
        editor.localImages.length > 0
            ? editor.localImages.map((img) => img.url)
            : (cocktail.item_images?.map((img) => img.images?.url).filter(Boolean) as string[]) || [];

    const images =
        displayImages.length > 0 ? displayImages : [require("@/assets/images/cocktails/house_martini.png")];

    return (
        <>
            <ItemDetailLayout
                id={cocktail.id}
                title={editor.name}
                images={images}
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
                    cocktail={cocktail}
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
                        generateComponent={<GenerateImageButton type="cocktail" id={id} variant="tile" />}
                    />
                </View>
            </AdaptiveSheetModal>
        </>
    );
}
