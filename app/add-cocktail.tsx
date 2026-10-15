import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";

import { VenueBrandProvider } from "@/components/nav/VenueBrandProvider";
import { AddDrinkWizard } from "@/components/screens/addDrink/AddDrinkWizard";
import { DraftEditScreen } from "@/components/screens/drink/edit/DraftEditScreen";

/**
 * A new drink is added with the step-by-step wizard. A draft saved by the
 * older editor (New > Drafts) opens on the drink edit page.
 */
export default function AddCocktailScreen() {
    const router = useRouter();
    const { barId, draftId, name, menuSectionId, from } = useLocalSearchParams<{
        barId?: string;
        from?: string;
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
                    startFrom={from || null}
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

    return <DraftEditScreen draftId={draftId} barId={barId} initialName={name} onExit={goBack} />;
}
