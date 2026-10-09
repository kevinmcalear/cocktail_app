import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";

import { BackbarTheme, Body, Button, useDs } from "@/components/ds";
import { IngredientScreen } from "@/components/screens/ingredient/IngredientScreen";
import type { PrepLine } from "@/components/screens/ingredient/PrepRecipe";
import { FEATURES } from "@/constants/features";
import { space } from "@/constants/tokens";
import { useFavorites } from "@/hooks/useFavorites";
import { useIngredient } from "@/hooks/useIngredients";
import { useStudyPile } from "@/hooks/useStudyPile";
import { recentEntry, useTrackRecent } from "@/hooks/useTrackRecent";
import { useCanEditItem } from "@/hooks/useViewAs";
import { orderedPictures } from "@/lib/itemImages";

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
    const { isFavorite, toggleFavorite } = useFavorites();
    const { toggleStudyPile, isInStudyPile } = useStudyPile();

    // isPending, not isLoading: "no data yet" includes the static prerender and the
    // first paint, when nothing is fetching, and those must not read as not found.
    const { data, isPending, error, refetch } = useIngredient(id);
    const ingredient = data?.ingredient ?? null;

    useTrackRecent(
        !!ingredient,
        ingredient ? recentEntry('ingredient', ingredient.id, ingredient.name, { barId: ingredient.bar_id ?? null }) : null
    );
    const canEdit = useCanEditItem(ingredient);

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

    return (
        <IngredientScreen
            ingredient={ingredient}
            lines={lines}
            drinks={(data?.usedIn ?? []).map((u) => ({ id: u.cocktail.id, name: u.cocktail.name }))}
            bottles={data?.bottles ?? []}
            pictures={orderedPictures(data?.heroImages)}
            isFavorite={isFavorite(key)}
            onToggleFavorite={() => toggleFavorite(key)}
            inStudyPile={isInStudyPile(key)}
            onToggleStudyPile={() => (FEATURES.study ? toggleStudyPile(key) : undefined)}
            canEdit={canEdit}
            onEdit={() => router.push(`/ingredient/${ingredient.id}/edit`)}
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
