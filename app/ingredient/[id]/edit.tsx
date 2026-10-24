import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { BackbarTheme, useDs } from "@/components/ds";
import { useAskAtSave } from "@/components/screens/ingredient/AskAtSave";
import { IngredientEditPage, useLeaveGuard } from "@/components/screens/ingredient/IngredientEditPage";
import { IngredientEditScreen } from "@/components/screens/ingredient/edit/IngredientEditScreen";
import { useIngredientEditor } from "@/hooks/useIngredientEditor";
import { toastDone } from "@/lib/toast";
import { useIngredient } from "@/hooks/useIngredients";

/**
 * /ingredient/<id>/edit, for links (Edit first on a recipe written as a note,
 * Add on a prep brought in with no recipe). A house prep opens its page in
 * editing (IngredientEditScreen); anything else opens every field. Done or
 * leaving goes back to where it came from.
 */
export default function EditIngredientScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { data, isPending } = useIngredient(id);
    const close = () => (router.canGoBack() ? router.back() : router.replace(`/ingredient/${id}`));
    if (isPending) return <Loading />;
    const isPrep = !!data?.recipe?.length || data?.ingredient?.ingredient_role === "prep";
    return isPrep ? <IngredientEditScreen id={id} onExit={close} /> : <AllFields id={id} onClose={close} />;
}

function AllFields({ id, onClose }: { id: string; onClose: () => void }) {
    const editor = useIngredientEditor(id);
    const { form } = editor;
    const allowExit = useLeaveGuard(editor.isDirty);
    const save = async () => {
        if (!(await editor.save())) return;
        toastDone("Ingredient saved", form.name.trim());
        allowExit();
        onClose();
    };
    const askAtSave = useAskAtSave(id, { name: form.name, description: form.description, abv: form.abv, lines: form.recipeItems }, () => void save());
    const onSave = () => (askAtSave.ask() ? undefined : void save());

    if (editor.loading) return <Loading />;
    return (
        <IngredientEditPage editor={editor} eyebrow="INGREDIENT" onBack={onClose} onSave={onSave}>
            {askAtSave.sheet}
        </IngredientEditPage>
    );
}

function Loading() {
    return (
        <BackbarTheme>
            <Spinner />
        </BackbarTheme>
    );
}

function Spinner() {
    const ds = useDs();
    return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: ds.c.ground }} accessibilityLabel="Loading ingredient">
            <ActivityIndicator color={ds.c.muted} />
        </View>
    );
}
