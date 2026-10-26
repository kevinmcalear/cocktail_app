import { useLocalSearchParams, useRouter } from "expo-router";

import { AddIngredientRoute } from "@/components/screens/addIngredient/AddIngredientRoute";
import { IngredientDraftEditScreen } from "@/components/screens/ingredient/edit/IngredientEditScreen";

/** A new ingredient is added with the wizard; a draft saved by the older editor (New > Drafts) opens on the ingredient page in editing. */
export default function AddIngredientScreen() {
    const { draftId } = useLocalSearchParams<{ draftId?: string }>();
    return draftId ? <IngredientDraft draftId={draftId} /> : <AddIngredientRoute />;
}

/** Done keeps it a draft; More > Publish ingredient makes it one. */
function IngredientDraft({ draftId }: { draftId: string }) {
    const router = useRouter();
    const { barId, name } = useLocalSearchParams<{ barId?: string; name?: string }>();
    const close = () => (router.canGoBack() ? router.back() : router.replace("/drafts"));
    return <IngredientDraftEditScreen draft={{ draftId, barId, initialName: name }} onExit={close} />;
}
