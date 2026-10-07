import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";

import { CocktailDraftInlineEditor } from "@/components/cocktail/CocktailDraftInlineEditor";
import { VenueBrandProvider } from "@/components/nav/VenueBrandProvider";
import { AddDrinkWizard } from "@/components/screens/addDrink/AddDrinkWizard";

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

/**
 * A new drink is added with the step-by-step wizard (full page and in the
 * workspace). A draft saved by the older editor still opens in it.
 */
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

    const draftId = draftIdProp !== undefined ? draftIdProp : draftIdParam;
    const barId = barIdProp !== undefined ? barIdProp : barIdParam;
    const menuSectionId = menuSectionIdProp !== undefined ? menuSectionIdProp : menuSectionIdParam;

    if (!draftId) {
        const wizard = (
            <AddDrinkWizard
                barId={barId || null}
                menuDraftId={menuDraftIdProp !== undefined ? menuDraftIdProp : menuDraftIdParam}
                menuSectionId={menuSectionId}
                initialName={initialNameProp !== undefined ? initialNameProp : nameParam}
                embedded={!!isInline}
                onClose={onClose ?? goBack}
                onSaved={(id) => {
                    if (onSave) onSave();
                    // From a menu, back to the menu; otherwise to the new drink.
                    else if (menuSectionId) goBack();
                    else router.replace(`/cocktail/${id}`);
                }}
            />
        );
        return isInline ? wizard : <VenueBrandProvider>{wizard}</VenueBrandProvider>;
    }

    return (
        <CocktailDraftInlineEditor
            draftId={draftId}
            barId={barId}
            menuDraftId={menuDraftIdProp !== undefined ? menuDraftIdProp : menuDraftIdParam}
            menuSectionId={menuSectionId}
            initialName={initialNameProp !== undefined ? initialNameProp : nameParam}
            embedded={!!isInline}
            onClose={onClose ?? goBack}
            onSave={onSave ?? goBack}
            onNestedItemPress={onNestedItemPress}
            onChromeState={onChromeState}
        />
    );
}
