import { useLocalSearchParams, useRouter } from "expo-router";
import { lazy, Suspense, useState } from "react";
import { View } from "react-native";

import { BackbarTheme, Body, Button, useDs } from "@/components/ds";
import { IngredientScreen } from "@/components/screens/ingredient/IngredientScreen";
import type { PrepLine } from "@/components/screens/ingredient/PrepRecipe";
import { space } from "@/constants/tokens";
import { useIngredient } from "@/hooks/useIngredients";
import { useStudyPile } from "@/hooks/useStudyPile";
import { useVenueFeature } from "@/hooks/useVenueFeatures";
import { recentEntry, useTrackRecent } from "@/hooks/useTrackRecent";
import { useCanEditItem } from "@/hooks/useViewAs";
import { orderedPictures } from "@/lib/itemImages";

// Editing in place only loads when someone edits, as the drink page does.
const IngredientEditScreen = lazy(() => import("@/components/screens/ingredient/edit/IngredientEditScreen").then((m) => ({ default: m.IngredientEditScreen })));

interface RecipeRow {
    id: string;
    ingredient: { id?: string; name: string; ingredient_role?: string | null } | null;
    amount: string | null;
    unit: string | null;
    preparation_notes: string | null;
    is_optional: boolean | null;
}

export default function IngredientDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { toggleStudyPile, isInStudyPile } = useStudyPile();
    const study = useVenueFeature("study");

    // isPending, not isLoading: "no data yet" includes the static prerender and the
    // first paint, when nothing is fetching, and those must not read as not found.
    const { data, isPending, error, refetch } = useIngredient(id);
    const ingredient = data?.ingredient ?? null;

    useTrackRecent(
        !!ingredient,
        ingredient ? recentEntry('ingredient', ingredient.id, ingredient.name, { barId: ingredient.bar_id ?? null }) : null
    );
    const canEdit = useCanEditItem(ingredient);
    const [isEditing, setIsEditing] = useState(false);

    if (isPending || !ingredient) {
        return (
            <BackbarTheme>
                <Empty
                    label={isPending ? "Loading ingredient" : error ? "Couldn't load this ingredient." : "Ingredient not found."}
                    onRetry={error ? () => void refetch() : undefined}
                    loading={isPending}
                />
            </BackbarTheme>
        );
    }

    const lines: PrepLine[] = ((data?.recipe ?? []) as unknown as RecipeRow[]).map((r) => ({
        id: r.id,
        name: r.ingredient?.name || "Hidden ingredient",
        ingredientId: r.ingredient?.id ?? null,
        amount: r.amount,
        unit: r.unit,
        note: r.preparation_notes?.trim() || null,
        optional: !!r.is_optional,
        houseMade: r.ingredient?.ingredient_role === 'prep',
    }));
    const key = `ingredient-${ingredient.id}`;

    // The page reads it; Edit turns a house prep's page into editing in place.
    if (isEditing) {
        return (
            <Suspense fallback={null}>
                <IngredientEditScreen id={ingredient.id} onExit={() => setIsEditing(false)} />
            </Suspense>
        );
    }

    return (
        <IngredientScreen
            ingredient={ingredient}
            lines={lines}
            drinks={(data?.usedIn ?? []).map((u) => ({ id: u.cocktail.id, name: u.cocktail.name }))}
            bottles={data?.bottles ?? []}
            pictures={orderedPictures(data?.heroImages)}
            inStudyPile={isInStudyPile(key)}
            onToggleStudyPile={() => (study ? toggleStudyPile(key) : undefined)}
            canEdit={canEdit}
            onEdit={(isPrep) => (isPrep ? setIsEditing(true) : router.push(`/ingredient/${ingredient.id}/edit`))}
        />
    );
}

function Empty({ label, onRetry, loading }: { label: string; onRetry?: () => void; loading: boolean }) {
    const ds = useDs();
    return (
        <View style={{ flex: 1, backgroundColor: ds.c.ground, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xl }} accessibilityLabel={label}>
            {loading ? null : <Body tone="muted">{label}</Body>}
            {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} /> : null}
        </View>
    );
}
