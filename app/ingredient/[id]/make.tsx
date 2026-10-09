import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";

import { BackbarTheme, Body, useDs } from "@/components/ds";
import { MakeScreen } from "@/components/screens/make/MakeScreen";
import { space } from "@/constants/tokens";
import { useActiveVenue } from "@/hooks/useActiveVenue";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useIngredient } from "@/hooks/useIngredients";
import { useItemPrep } from "@/hooks/usePrepCard";
import { useCanEditItem } from "@/hooks/useViewAs";
import type { RecipeLine } from "@/lib/scale";

/** Make mode for a house prep: /ingredient/<id>/make?factor=0.66 opens on the size picked on its page. */
export default function MakeRoute() {
    const { id, factor, mode } = useLocalSearchParams<{ id: string; factor?: string; mode?: string }>();
    const { data } = useIngredient(id);
    const { data: card } = useItemPrep(id);
    const ingredient = data?.ingredient ?? null;
    const canEdit = useCanEditItem(ingredient);
    const { data: capabilities } = useCapabilities(ingredient?.bar_id ?? null);
    const accent = useActiveVenue().venues.find((v) => v.id === ingredient?.bar_id)?.accent ?? undefined;

    if (!ingredient || !card) return <Waiting />;
    const recipe: RecipeLine[] = ((data?.recipe ?? []) as unknown as { id: string; ingredient: { name: string } | null; amount: string | null; unit: string | null }[]).map((r) => ({
        id: r.id,
        name: r.ingredient?.name || "Hidden ingredient",
        amount: r.amount,
        unit: r.unit,
    }));
    const start = Number(factor);
    return (
        <MakeScreen
            itemId={ingredient.id}
            name={ingredient.name}
            recipe={recipe}
            card={card}
            accent={accent}
            startFactor={start > 0 ? start : 1}
            startMode={mode === 'have' ? 'have' : undefined}
            canLearn={ingredient.bar_id ? !!capabilities?.includes('prep') || canEdit : canEdit}
        />
    );
}

function Waiting() {
    return (
        <BackbarTheme scheme="light">
            <Ground />
        </BackbarTheme>
    );
}

function Ground() {
    const ds = useDs();
    return (
        <View style={{ flex: 1, backgroundColor: ds.c.ground, padding: space.xl, justifyContent: "center" }} accessibilityLabel="Loading">
            <Body tone="muted"> </Body>
        </View>
    );
}
