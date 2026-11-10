import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";

import { VenueBrandProvider } from "@/components/nav/VenueBrandProvider";
import { AddDrinkWizard } from "@/components/screens/addDrink/AddDrinkWizard";
import { WizardWaiting } from "@/components/screens/addDrink/WizardWaiting";
import { DraftEditScreen } from "@/components/screens/drink/edit/DraftEditScreen";
import { useCreateBar } from "@/hooks/useBringInPlace";
import { emptySummary } from "@/lib/bringInBatch";
import { approved, canCheck } from "@/lib/importReview";
import { HOME_BAR } from "@/lib/itemRoutes";
import { useBringIn } from "@/store/useBringIn";

/**
 * A new drink is added with the step-by-step wizard. A draft saved by the
 * older editor (New > Drafts) opens on the drink edit page. A link that
 * names no bar opens where you are, once that's known (useCreateBar).
 */
export default function AddCocktailScreen() {
    const router = useRouter();
    const { barId, draftId, name, menuSectionId, from, round, back, review, drink, imported } = useLocalSearchParams<{
        barId?: string;
        /** "Edit this drink" in a big import's review: saving here approves that drink there. */
        review?: string;
        drink?: string;
        /** "1" from an import (Edit this drink, Edit all): the draft is the import, not one left off. */
        imported?: string;
        from?: string;
        /** "1" from the first round: its first cocktail (a classic at Review, or from scratch), then back to the Library. */
        round?: string;
        /** "1" from the setup checklist's First drinks: the same first cocktail, then back to the checklist. */
        back?: string;
        draftId?: string;
        name?: string;
        menuSectionId?: string;
    }>();

    // A cold link (no barId) waits for where you are; `barId=home` is your own bar.
    const named = barId || undefined;
    const place = useCreateBar(named);

    const goBack = () => {
        if (router.canGoBack()) router.back();
        else router.replace("/");
    };

    if (!draftId) {
        if (!place.ready) return <WizardWaiting />;
        return (
            <VenueBrandProvider barId={place.barId}>
                <AddDrinkWizard
                    barId={place.barId}
                    menuSectionId={menuSectionId}
                    initialName={name}
                    startFrom={from || null}
                    firstRound={round === "1"}
                    imported={imported === "1"}
                    review={review && drink ? `${review}#${drink}` : null}
                    embedded={false}
                    onClose={goBack}
                    onSaved={(id) => {
                        // From a menu, back to the menu; from a review, back to it, approved; otherwise to the new drink.
                        if (review && drink) {
                            goBack();
                            const made = { drinkId: id, summary: { ...emptySummary("recipes"), drinksNew: 1 }, warnings: [] };
                            // Only if it's still to check there: a drink is never counted twice.
                            useBringIn.getState().editReview(review, (r) => (canCheck(r, Number(drink)) ? approved(r, Number(drink), made, new Date().toISOString()) : r));
                        } else if (menuSectionId || back === "1") goBack();
                        else if (round === "1") router.replace("/drinks");
                        else router.replace(`/cocktail/${id}`);
                    }}
                />
            </VenueBrandProvider>
        );
    }

    return <DraftEditScreen draftId={draftId} barId={named === HOME_BAR ? undefined : named} initialName={name} onExit={goBack} />;
}
