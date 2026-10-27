import { useLocalSearchParams, useRouter } from "expo-router";

import { DrinkEditScreen } from "@/components/screens/drink/edit/DrinkEditScreen";

/**
 * /cocktail/<id>/edit: the drink page in editing, for the Library's drink pane
 * (and links). Done or leaving goes back to where Edit was pressed. ?fit=1
 * opens on Fit it to the glass.
 */
export default function EditCocktailScreen() {
    const router = useRouter();
    const { id, fit } = useLocalSearchParams<{ id: string; fit?: string }>();
    const exit = () => {
        if (router.canGoBack()) router.back();
        else router.replace(`/cocktail/${id}`);
    };
    return <DrinkEditScreen id={id} onExit={exit} openFit={fit === "1"} />;
}
