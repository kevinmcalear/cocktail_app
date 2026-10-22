import { Redirect, useLocalSearchParams } from "expo-router";
import React, { lazy, Suspense, useState } from "react";

import { useCocktail } from "@/hooks/useCocktails";
import { useStudyPile } from "@/hooks/useStudyPile";
import { recentEntry, useTrackRecent } from "@/hooks/useTrackRecent";
import { useItemEditAccess } from "@/hooks/useViewAs";
import { heroPicture } from "@/lib/itemImages";
import { DrinkLoading, DrinkScreen } from "@/components/screens/drink/DrinkScreen";
import { CouldNotLoad } from "@/components/screens/safety/NotAvailable";

// Editing in place only loads when someone edits, which keeps its gesture code off the web's first load.
const DrinkEditScreen = lazy(() => import("@/components/screens/drink/edit/DrinkEditScreen").then((m) => ({ default: m.DrinkEditScreen })));

// For /dev/drink, which loads it through this route so the web build reuses this
// route's chunk instead of putting the whole drink page in the shared one.
export { DrinkScreen };
export { BatchSheet } from "@/components/screens/batch/BatchSheet";

export default function CocktailDetailsScreen() {
    const { id, batch } = useLocalSearchParams<{ id: string; batch?: string }>();

    const { toggleStudyPile, isInStudyPile } = useStudyPile();

    // A placeholder (the tapped row's name and picture) paints the hero only: the rest waits for the drink.
    const query = useCocktail(id as string, { seeded: true });
    const { error, refetch } = query;
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

    const editAccess = useItemEditAccess(cocktail);
    const [isEditing, setIsEditing] = useState(false);

    // Not yours to read (another bar's drink): its public page, if it's published.
    if ((error as { code?: string } | null)?.code === "PGRST116") return <Redirect href={`/d/${id}`} />;
    if (error) return <CouldNotLoad what="drink" failed={{ retry: () => void refetch() }} />;
    // The drink page reads it; Edit turns the same page into editing in place (DrinkEditScreen).
    if (!isEditing) {
        return cocktail ? (
            <DrinkScreen
                item={cocktail}
                inStudyPile={isInStudyPile(cocktail.id)}
                onToggleStudyPile={() => toggleStudyPile(cocktail.id)}
                canEdit={editAccess === "edit"}
                adminFix={editAccess === "admin"}
                onEdit={() => setIsEditing(true)}
                openBatch={batch === "1"}
                sheet
            />
        ) : (
            <DrinkLoading seed={query.isPlaceholderData ? query.data : null} />
        );
    }

    return (
        <Suspense fallback={null}>
            <DrinkEditScreen id={id as string} onExit={() => setIsEditing(false)} />
        </Suspense>
    );
}
