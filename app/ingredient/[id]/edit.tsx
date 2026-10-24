import { useLocalSearchParams, useRouter } from "expo-router";

import { IngredientEditScreen } from "@/components/screens/ingredient/edit/IngredientEditScreen";

/**
 * /ingredient/<id>/edit: the ingredient page in editing, for links (Edit
 * first on a recipe written as a note, Add on a prep brought in with no
 * recipe). Done or leaving goes back to where it came from.
 */
export default function EditIngredientScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const close = () => (router.canGoBack() ? router.back() : router.replace(`/ingredient/${id}`));
    return <IngredientEditScreen id={id} onExit={close} />;
}
