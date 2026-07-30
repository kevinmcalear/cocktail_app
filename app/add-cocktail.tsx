import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";

import { CocktailDraftInlineEditor } from "@/components/cocktail/CocktailDraftInlineEditor";

interface AddCocktailProps {
    isInline?: boolean;
    draftIdProp?: string;
    barIdProp?: string;
    menuDraftIdProp?: string;
    menuSectionIdProp?: string;
    initialNameProp?: string;
    onClose?: () => void;
    onSave?: () => void;
    onNestedItemPress?: (ingredientId: string) => void;
    onChromeState?: (state: import("@/lib/editorChrome").EditorChromeState | null) => void;
}

/** Full-page and workspace create both use the inline editable detail view. */
export default function AddCocktailScreen({
    isInline,
    draftIdProp,
    barIdProp,
    menuDraftIdProp,
    menuSectionIdProp,
    initialNameProp,
    onClose,
    onSave,
    onNestedItemPress,
    onChromeState,
}: AddCocktailProps = {}) {
    const router = useRouter();
    const {
        barId: barIdParam,
        draftId: draftIdParam,
        name: nameParam,
        menuDraftId: menuDraftIdParam,
        menuSectionId: menuSectionIdParam,
    } = useLocalSearchParams<{
        barId?: string;
        draftId?: string;
        name?: string;
        menuDraftId?: string;
        menuSectionId?: string;
    }>();

    const goBack = () => {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)");
    };

    return (
        <CocktailDraftInlineEditor
            draftId={draftIdProp !== undefined ? draftIdProp : draftIdParam}
            barId={barIdProp !== undefined ? barIdProp : barIdParam}
            menuDraftId={menuDraftIdProp !== undefined ? menuDraftIdProp : menuDraftIdParam}
            menuSectionId={menuSectionIdProp !== undefined ? menuSectionIdProp : menuSectionIdParam}
            initialName={initialNameProp !== undefined ? initialNameProp : nameParam}
            embedded={!!isInline}
            onClose={onClose ?? goBack}
            onSave={onSave ?? goBack}
            onNestedItemPress={onNestedItemPress}
            onChromeState={onChromeState}
        />
    );
}
