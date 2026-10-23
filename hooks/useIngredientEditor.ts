import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";

import type { SortableRecipeItem } from '@/lib/recipeItem';
import { useDrafts } from "@/hooks/useDrafts";
import { refreshIngredients, useDropdowns } from "@/hooks/useDropdowns";
import { useIngredient } from "@/hooks/useIngredients";
import { recentEntry, useTrackRecent } from "@/hooks/useTrackRecent";
import { resolveIngredientId, syncIngredientRefsInParentDrafts, updateParentDraftsWithPublishedId } from "@/lib/drafts";
import { fetchEditableRecipes } from "@/lib/editableRecipes";
import { changedColumns, levelColumns, levelFields, OVERRIDE_LEVELS, saveItemTags } from "@/lib/itemSave";
import { applyIngredientHandoff, withoutSelfRecipeRefs } from "@/lib/ingredientHandoff";
import { mapPresentationRecipeToEditItem } from "@/lib/recipeUtils";
import { capitalize, capitalizeFirst } from "@/lib/stringUtils";
import { supabase } from "@/lib/supabase";
import { toastDone } from "@/lib/toast";
import { useAppStore } from "@/store/useAppStore";
import { getPreferredUnit } from "@/store/useSettingsStore";

/**
 * Everything the ingredient editor changes. A draft (the `drafts` table)
 * keeps exactly this as its draft_data.
 */
export interface IngredientForm {
    name: string;
    description: string;
    brandMaker: string;
    /** What it's a kind of ("Tanqueray" is a kind of "Gin"). */
    generic: { id: string; name: string } | null;
    abv: string;
    selectedCategories: string[];
    recipeItems: SortableRecipeItem[];
    barId: string | null;
    overrideVisibility: string | null;
    overrideGeneric: string | null;
    overrideSpecific: string | null;
    overrideMeasurement: string | null;
    overridePrep: string | null;
    hideFromSearch: boolean;
}

const EMPTY: IngredientForm = {
    name: "",
    description: "",
    brandMaker: "",
    generic: null,
    abv: "",
    selectedCategories: [],
    recipeItems: [],
    barId: null,
    overrideVisibility: null,
    overrideGeneric: null,
    overrideSpecific: null,
    overrideMeasurement: null,
    overridePrep: null,
    hideFromSearch: false,
};

type Lines = SortableRecipeItem[];
/** The items columns the form edits (shared by Save and publishing a draft). */
const ingredientColumns = (f: IngredientForm) => ({
    name: capitalizeFirst(f.name),
    description: f.description.trim() || null,
    brand_maker: capitalize(f.brandMaker) || null,
    generic_id: f.generic?.id ?? null,
    abv: f.abv ? parseFloat(f.abv) : null,
    bar_id: f.barId || null,
    ...levelColumns(f),
    hide_from_search: f.hideFromSearch,
});
const NEW_LINE = () => ({ amount: "", unit: getPreferredUnit(), preparation_notes: "", is_optional: false });

/** The form and its dirty state, shared by the saved and the draft editor. */
function useForm(selfId: string | null) {
    const [form, setForm] = useState<IngredientForm>(EMPTY);
    // What was last loaded or saved: isDirty compares against it, and Save writes only what differs.
    const [saved, setSaved] = useState<IngredientForm | null>(null);
    const set = (patch: Partial<IngredientForm>) => setForm((f) => ({ ...f, ...patch }));
    const setRecipeItems = (next: Lines | ((prev: Lines) => Lines)) =>
        setForm((f) => ({ ...f, recipeItems: typeof next === "function" ? next(f.recipeItems) : next }));
    // Stable: the loaders below run it from effects.
    const load = useCallback((values: IngredientForm) => {
        setForm(values);
        setSaved(values);
    }, []);
    const markClean = () => setSaved(form);

    // A new ingredient made from this recipe comes back onto it (only to the editor that asked).
    useEffect(() => {
        if (!selfId) return;
        const take = ({ recentlyCreatedItem: handoff, setRecentlyCreatedItem }: ReturnType<typeof useAppStore.getState>) => {
            if (handoff?.type !== "ingredient" || handoff.targetId !== selfId) return;
            setForm((f) => ({ ...f, recipeItems: applyIngredientHandoff(f.recipeItems, handoff, selfId, NEW_LINE()) ?? f.recipeItems }));
            setRecentlyCreatedItem(null);
        };
        take(useAppStore.getState());
        return useAppStore.subscribe(take);
    }, [selfId]);

    const { data: dropdowns } = useDropdowns({ ingredients: true });
    const { drafts, saveDraft, deleteDraft, isFetching, loaded: draftsLoaded, failed: draftsFailed } = useDrafts();
    // What a line can be: the published ingredients and the drafted ones, drafts first.
    const catalog = useMemo(() => {
        const draftRows = drafts
            .filter((d) => d.entity_type === "ingredient")
            .map((d) => ({ id: d.id, name: (d.draft_data as { name?: string } | null)?.name || "Untitled Ingredient Draft" }));
        const published = (dropdowns?.ingredients ?? []).map((i) => ({ id: i.id, name: i.name ?? "" }));
        const seen = new Set<string>();
        return [...draftRows, ...published].filter((i) => !seen.has(i.id) && !!seen.add(i.id));
    }, [dropdowns?.ingredients, drafts]);

    return {
        form,
        set,
        setRecipeItems,
        load,
        markClean,
        loaded: saved !== null,
        saved,
        isDirty: saved !== null && JSON.stringify(form) !== JSON.stringify(saved),
        selfId,
        dropdowns,
        catalog,
        drafts,
        saveDraft,
        deleteDraft,
        draftsFetching: isFetching,
        draftsLoaded,
        draftsFailed,
    };
}

/** A saved ingredient: read from its row and raw recipe, written back on save. */
export function useIngredientEditor(id: string) {
    const queryClient = useQueryClient();
    const editor = useForm(id);
    const { data } = useIngredient(id);
    const [saving, setSaving] = useState(false);
    const loadedFor = useRef<string | null>(null);
    const { load } = editor;

    useEffect(() => {
        const ingredient = data?.ingredient;
        if (!ingredient || loadedFor.current === id) return;
        loadedFor.current = id;
        // Recipe rows, visibility overrides and tags come from the raw tables: the
        // presentation views mask or omit them, and a save writes them all back.
        // Once per ingredient: a refetch of the page's data mustn't undo what's typed.
        Promise.all([
            fetchEditableRecipes(id),
            supabase
                .from("items")
                .select(`${OVERRIDE_LEVELS}, item_categories(category_id)` as const)
                .eq("id", id)
                .single(),
        ])
            .then(([recipes, { data: raw, error }]) => {
                if (error || !raw) throw error ?? new Error("Ingredient not found");
                load({
                    name: ingredient.name || "",
                    description: ingredient.description || "",
                    brandMaker: ingredient.brand_maker || "",
                    generic: ingredient.generic ?? null,
                    abv: ingredient.abv?.toString() || "",
                    selectedCategories: raw.item_categories.map((ic) => ic.category_id),
                    // Someone who can't edit the recipe reads it as shown; Save then asks for their own version (useAskAtSave).
                    recipeItems: (recipes.length ? recipes : (data.recipe ?? [])).map((r) => mapPresentationRecipeToEditItem(r, { includeCocktailFields: true })),
                    barId: ingredient.bar_id || null,
                    ...levelFields(raw),
                    hideFromSearch: ingredient.hide_from_search === true,
                });
            })
            .catch(() => {
                loadedFor.current = null;
                Alert.alert("Error", "Could not load this ingredient for editing.");
            });
    }, [data, id, load]);

    const save = async (): Promise<boolean> => {
        const f = editor.form;
        const loaded = editor.saved;
        if (!loaded) return false;
        if (!f.name.trim()) {
            Alert.alert("Missing Info", "Name is required.");
            return false;
        }
        setSaving(true);
        try {
            // Only what changed since it loaded, so someone else's edit to another field isn't undone.
            const changed = changedColumns(ingredientColumns(loaded), ingredientColumns(f));
            if (Object.keys(changed).length) {
                const { error: updateError } = await supabase.from("items").update(changed).eq("id", id);
                if (updateError) throw updateError;
            }

            await saveItemTags(id, loaded.selectedCategories, f.selectedCategories);

            const { error: deleteError } = await supabase.from("recipes").delete().eq("recipe_item_id", id);
            if (deleteError) throw deleteError;
            if (f.recipeItems.length > 0) {
                const { error: insertError } = await supabase.from("recipes").insert(
                    f.recipeItems.map((item, index) => ({
                        recipe_item_id: id,
                        ingredient_item_id: item.ingredient_id,
                        amount: parseFloat(item.amount) || null,
                        unit: item.unit || null,
                        // The spec pad edits these, so they're written back, not dropped.
                        preparation_notes: item.preparation_notes?.trim() || null,
                        is_optional: !!item.is_optional,
                        sort_order: index,
                    }))
                );
                if (insertError) throw insertError;
            }

            await queryClient.invalidateQueries({ queryKey: ["ingredient", id] });
            await queryClient.invalidateQueries({ queryKey: ["ingredients"] });
            await queryClient.invalidateQueries({ queryKey: ["cocktail"] });
            await queryClient.invalidateQueries({ queryKey: ["cocktails"] });
            await refreshIngredients(queryClient, [id]);
            editor.markClean();
            return true;
        } catch (error) {
            console.error("Update error:", error);
            Alert.alert("Error", (error as Error | null)?.message || "Failed to update ingredient.");
            return false;
        } finally {
            setSaving(false);
        }
    };

    return { ...editor, role: data?.ingredient?.ingredient_role ?? null, loading: !editor.loaded, saving, save, draftId: null };
}

/**
 * An ingredient draft saved by the older editor (New > Drafts). Save keeps
 * it a draft; publish makes it an ingredient, publishing any drafted
 * ingredients its recipe uses first.
 */
export function useIngredientDraftEditor({ draftId, barId: initialBarId, initialName, attachTo }: { draftId: string; barId?: string | null; initialName?: string | null; attachTo?: string | null }) {
    const queryClient = useQueryClient();
    const editor = useForm(draftId);
    const { drafts, saveDraft, deleteDraft, draftsFetching, draftsLoaded, load, form } = editor;
    const [saving, setSaving] = useState(false);
    const setRecentlyCreatedItem = useAppStore((s) => s.setRecentlyCreatedItem);
    const loadedFor = useRef<string | null>(null);

    const tracked = drafts.find((d) => d.id === draftId) ?? null;
    useTrackRecent(
        !!tracked,
        tracked ? recentEntry("ingredient", tracked.id, (tracked.draft_data as Partial<IngredientForm> | null)?.name || form.name || "Untitled Ingredient", { isDraft: true, barId: tracked.bar_id ?? form.barId ?? null }) : null
    );

    useEffect(() => {
        if (loadedFor.current === draftId || !draftsLoaded || draftsFetching) return;
        loadedFor.current = draftId;
        const data = (drafts.find((d) => d.id === draftId)?.draft_data ?? null) as Partial<IngredientForm> | null;
        load({
            ...EMPTY,
            ...data,
            name: data?.name || (initialName ? capitalizeFirst(initialName) : ""),
            generic: data?.generic || null,
            recipeItems: withoutSelfRecipeRefs(data?.recipeItems || [], draftId),
            barId: data?.barId || initialBarId || null,
            hideFromSearch: data?.hideFromSearch === true,
        });
    }, [draftId, drafts, draftsFetching, draftsLoaded, load, initialName, initialBarId]);

    /** Saves the draft; quietly (no toast) when it's on the way somewhere else. */
    const saveAsDraft = async (silent = false): Promise<boolean> => {
        try {
            setSaving(true);
            const draftData = { ...form, recipeItems: withoutSelfRecipeRefs(form.recipeItems, draftId) };
            await saveDraft({ id: draftId, entityType: "ingredient", draftData });
            const displayName = capitalizeFirst(form.name) || "Untitled Ingredient Draft";
            // Only the editor that opened this one gets it back, never every mounted editor.
            if (attachTo) setRecentlyCreatedItem({ type: "ingredient", id: draftId, name: displayName, targetId: attachTo });
            // Keep the recipes that use this draft in step with its name.
            await syncIngredientRefsInParentDrafts(draftId, { name: displayName }, drafts, saveDraft);
            editor.load(draftData);
            if (!silent) toastDone("Draft saved");
            return true;
        } catch (error) {
            console.error("Draft error:", error);
            if (!silent) Alert.alert("Error", "Failed to save draft.");
            return false;
        } finally {
            setSaving(false);
        }
    };

    /** Publishes the draft as an ingredient; the new id, or null when it failed. */
    const publish = async (): Promise<string | null> => {
        if (!form.name.trim()) {
            Alert.alert("Missing Info", "Name is required.");
            return null;
        }
        setSaving(true);
        try {
            // A drafted ingredient in its recipe is published first.
            const lines = [];
            for (const item of withoutSelfRecipeRefs(form.recipeItems, draftId)) {
                const resolvedId = await resolveIngredientId(item.ingredient_id, drafts);
                if (resolvedId !== item.ingredient_id) await updateParentDraftsWithPublishedId(item.ingredient_id, resolvedId, drafts, saveDraft);
                lines.push({ ...item, ingredient_id: resolvedId });
            }
            const { data: ingredient, error } = await supabase
                .from("items")
                .insert({ ...ingredientColumns(form), item_type: "ingredient" })
                .select()
                .single();
            if (error || !ingredient) throw error;
            const newId = ingredient.id;
            for (const catId of form.selectedCategories) {
                await supabase.from("item_categories").upsert({ item_id: newId, category_id: catId, is_primary: true }, { onConflict: "item_id,category_id" });
            }
            if (lines.length > 0) {
                const { error: recipeError } = await supabase.from("recipes").insert(
                    lines.map((item, index) => ({
                        recipe_item_id: newId,
                        ingredient_item_id: item.ingredient_id,
                        amount: parseFloat(item.amount) || null,
                        unit: item.unit || null,
                        preparation_notes: item.preparation_notes?.trim() || null,
                        is_optional: !!item.is_optional,
                        sort_order: index,
                    }))
                );
                if (recipeError) throw recipeError;
            }

            queryClient.invalidateQueries({ queryKey: ["ingredients"] });
            await refreshIngredients(queryClient, [newId]);
            await updateParentDraftsWithPublishedId(draftId, newId, drafts, saveDraft, capitalizeFirst(form.name));
            await deleteDraft(draftId);
            if (form.barId) queryClient.invalidateQueries({ queryKey: ["bar", form.barId] });
            if (attachTo) setRecentlyCreatedItem({ type: "ingredient", id: newId, name: form.name.trim(), targetId: attachTo, replacedId: draftId });
            editor.load(form);
            return newId;
        } catch (error) {
            console.error("Creation error:", error);
            Alert.alert("Error", (error as Error | null)?.message || "Failed to create ingredient.");
            return null;
        } finally {
            setSaving(false);
        }
    };

    return { ...editor, role: null, loading: !editor.loaded, saving, saveAsDraft, publish, draftId };
}

export type IngredientEditor = ReturnType<typeof useIngredientEditor> | ReturnType<typeof useIngredientDraftEditor>;
