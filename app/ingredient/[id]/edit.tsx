import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { BackbarTheme, useDs } from "@/components/ds";
import { VenueBrandProvider } from "@/components/nav/VenueBrandProvider";
import { useAskAtSave } from "@/components/screens/ingredient/AskAtSave";
import { FindSheet } from "@/components/screens/ingredient/IngredientEditSheets";
import { IngredientEditPage, useLeaveGuard } from "@/components/screens/ingredient/IngredientEditPage";
import { PrepEditor } from "@/components/screens/ingredient/PrepEditor";
import { useIngredientEditor } from "@/hooks/useIngredientEditor";
import { toastDone } from "@/lib/toast";
import { getPreferredUnit } from "@/store/useSettingsStore";

/**
 * Editing a saved ingredient. A house prep edits as its lines
 * (prep-prep-edit-shared), with All fields for the rest; anything else opens
 * every field. Save asks first when other drinks use the prep (useAskAtSave).
 */
export default function EditIngredientScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const editor = useIngredientEditor(id);
    const { form } = editor;
    const [allFields, setAllFields] = useState(false);
    const [adding, setAdding] = useState(false);
    const allowExit = useLeaveGuard(editor.isDirty);
    const close = () => (router.canGoBack() ? router.back() : router.replace(`/ingredient/${id}`));

    const save = async () => {
        if (!(await editor.save())) return;
        toastDone("Ingredient saved", form.name.trim());
        allowExit();
        close();
    };
    const askAtSave = useAskAtSave(id, { name: form.name, description: form.description, abv: form.abv, lines: form.recipeItems }, () => void save());
    const onSave = () => (askAtSave.ask() ? undefined : void save());

    if (editor.loading) return <Loading />;

    if (!allFields && (form.recipeItems.length > 0 || editor.role === "prep")) {
        return (
            <VenueBrandProvider barId={form.barId ?? undefined}>
                <PrepEditor
                    name={form.name}
                    onName={(name) => editor.set({ name })}
                    lines={form.recipeItems}
                    onAmount={(i, amount) => editor.setRecipeItems((prev) => prev.map((r, j) => (j === i ? { ...r, amount } : r)))}
                    onAdd={() => setAdding(true)}
                    description={form.description}
                    onDescription={(description) => editor.set({ description })}
                    onBack={close}
                    onSave={onSave}
                    saving={editor.saving}
                    onAllFields={() => setAllFields(true)}
                />
                {adding ? (
                    <FindSheet
                        title="Add an ingredient"
                        ingredients={editor.catalog}
                        aliases={editor.dropdowns?.ingredientAliases}
                        loading={!editor.dropdowns?.ingredients}
                        excludeId={id}
                        onClose={() => setAdding(false)}
                        onPick={(p) => {
                            setAdding(false);
                            editor.setRecipeItems((prev) => [...prev, { ingredient_id: p.id, name: p.name, amount: "", unit: getPreferredUnit(), preparation_notes: "", is_optional: false }]);
                        }}
                        onNew={(name) => {
                            setAdding(false);
                            router.push({ pathname: "/add-ingredient", params: { name, barId: form.barId || "", attachTo: id } });
                        }}
                    />
                ) : null}
                {askAtSave.sheet}
            </VenueBrandProvider>
        );
    }

    return (
        <IngredientEditPage editor={editor} eyebrow={form.recipeItems.length || editor.role === "prep" ? "PREP" : "INGREDIENT"} onBack={close} onSave={onSave}>
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
