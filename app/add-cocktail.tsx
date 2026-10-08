import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";

import { CocktailDraftInlineEditor } from "@/components/cocktail/CocktailDraftInlineEditor";
import { VenueBrandProvider } from "@/components/nav/VenueBrandProvider";
import { AddDrinkWizard } from "@/components/screens/addDrink/AddDrinkWizard";

/**
 * A new drink is added with the step-by-step wizard. A draft saved by the
 * older editor (New > Drafts) still opens in it.
 */
export default function AddCocktailScreen() {
    const router = useRouter();
    const { barId, draftId, name, menuSectionId } = useLocalSearchParams<{
        barId?: string;
        draftId?: string;
        name?: string;
        menuSectionId?: string;
    }>();

    const goBack = () => {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)");
    };

    if (!draftId) {
        return (
            <VenueBrandProvider>
                <AddDrinkWizard
                    barId={barId || null}
                    menuSectionId={menuSectionId}
                    initialName={name}
                    embedded={false}
                    onClose={goBack}
                    onSaved={(id) => {
                        // From a menu, back to the menu; otherwise to the new drink.
                        if (menuSectionId) goBack();
                        else router.replace(`/cocktail/${id}`);
                    }}
                />
            </VenueBrandProvider>
        );
    }

    return <CocktailDraftInlineEditor draftId={draftId} barId={barId} initialName={name} embedded={false} onClose={goBack} onSave={goBack} />;
}
