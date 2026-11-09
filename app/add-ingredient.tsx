import { useLocalSearchParams, useRouter } from "expo-router";
import { View } from "react-native";

import { useDs } from "@/components/ds";

import { AddIngredientRoute } from "@/components/screens/addIngredient/AddIngredientRoute";
import { IngredientDraftEditScreen } from "@/components/screens/drink/edit/EditRoutesLazy";

/** A new ingredient is added with the wizard; a draft saved by the older editor (New > Drafts) opens on the ingredient page in editing. */
export default function AddIngredientScreen() {
    const { draftId } = useLocalSearchParams<{ draftId?: string }>();
    return draftId ? <IngredientDraft draftId={draftId} /> : <AddIngredientRoute />;
}

/** Done keeps it a draft; More > Publish ingredient makes it one. */
function IngredientDraft({ draftId }: { draftId: string }) {
    const router = useRouter();
    const ds = useDs();
    const { barId, name } = useLocalSearchParams<{ barId?: string; name?: string }>();
    const close = () => (router.canGoBack() ? router.back() : router.replace("/drafts"));
    // A whole page, on its own ground: on the web this route is see-through, for A bottle you buy's dialog (components/nav/seeThrough.ts).
    return (
        <View style={{ flex: 1, backgroundColor: ds.c.ground }}>
            <IngredientDraftEditScreen draft={{ draftId, barId, initialName: name }} onExit={close} />
        </View>
    );
}
