import { decode } from "base64-arraybuffer";
import * as FilePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import { useCocktail } from "@/hooks/useCocktails";
import { useDropdowns } from "@/hooks/useDropdowns";
import { capitalize } from "@/lib/stringUtils";
import { mapPresentationRecipeToEditItem, sortRecipesByOrder } from "@/lib/recipeUtils";
import { supabase } from "@/lib/supabase";
import type { ImageItem } from "@/components/cocktail/SortableImageList";

export type SpecCategory = "method" | "glassware" | "family" | "ice";
export type SpecDbField = "method_id" | "glassware_id" | "family_id" | "ice_id";

import type { SortableRecipeItem } from "@/components/recipe/SortableRecipeList";

const SPEC_DB_FIELD: Record<SpecCategory, SpecDbField> = {
    method: "method_id",
    glassware: "glassware_id",
    family: "family_id",
    ice: "ice_id",
};

export function useCocktailEditor(id: string, { enabled = true }: { enabled?: boolean } = {}) {
    const queryClient = useQueryClient();
    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns();
    const { data: cocktail, isLoading: loadingCocktail } = useCocktail(enabled ? id : undefined);

    const isLoaded = useRef(false);
    const [isDirty, setIsDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [origin, setOrigin] = useState("");
    const [notes, setNotes] = useState("");

    const [methodId, setMethodId] = useState<string | null>(null);
    const [glasswareId, setGlasswareId] = useState<string | null>(null);
    const [familyId, setFamilyId] = useState<string | null>(null);
    const [iceId, setIceId] = useState<string | null>(null);

    const [barId, setBarId] = useState<string | null>(null);
    const [overrideVisibility, setOverrideVisibility] = useState<string | null>(null);
    const [overrideGeneric, setOverrideGeneric] = useState<string | null>(null);
    const [overrideSpecific, setOverrideSpecific] = useState<string | null>(null);
    const [overrideMeasurement, setOverrideMeasurement] = useState<string | null>(null);
    const [overridePrep, setOverridePrep] = useState<string | null>(null);

    const [recipeItems, setRecipeItems] = useState<SortableRecipeItem[]>([]);
    const [localImages, setLocalImages] = useState<ImageItem[]>([]);

    const markDirty = useCallback(() => setIsDirty(true), []);

    const wrap = <T,>(setter: (v: T) => void) => (v: T) => {
        setter(v);
        markDirty();
    };

    const setNameDirty = wrap(setName);
    const setDescriptionDirty = wrap(setDescription);
    const setOriginDirty = wrap(setOrigin);
    const setNotesDirty = wrap(setNotes);
    const setMethodIdDirty = wrap(setMethodId);
    const setGlasswareIdDirty = wrap(setGlasswareId);
    const setFamilyIdDirty = wrap(setFamilyId);
    const setIceIdDirty = wrap(setIceId);
    const setBarIdDirty = wrap(setBarId);
    const setOverrideVisibilityDirty = wrap(setOverrideVisibility);
    const setOverrideGenericDirty = wrap(setOverrideGeneric);
    const setOverrideSpecificDirty = wrap(setOverrideSpecific);
    const setOverrideMeasurementDirty = wrap(setOverrideMeasurement);
    const setOverridePrepDirty = wrap(setOverridePrep);

    const setRecipeItemsDirty = useCallback((items: SortableRecipeItem[] | ((prev: SortableRecipeItem[]) => SortableRecipeItem[])) => {
        setRecipeItems(items);
        markDirty();
    }, [markDirty]);

    const setLocalImagesDirty = useCallback((images: ImageItem[] | ((prev: ImageItem[]) => ImageItem[])) => {
        setLocalImages(images);
        markDirty();
    }, [markDirty]);

    useEffect(() => {
        if (!enabled || !cocktail || isLoaded.current) return;
        isLoaded.current = true;
        const c = cocktail as any;

        setName(c.name || "");
        setDescription(c.description || "");
        setOrigin(c.origin || "");
        setNotes(c.notes || "");
        setMethodId(c.item_methods?.[0]?.method_item_id || null);
        setGlasswareId(c.glassware_id);
        setFamilyId(c.family_id);
        setIceId(c.ice_id);

        if (c.item_images) {
            const sorted = [...c.item_images].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
            setLocalImages(
                sorted
                    .map((ci: any) => ({ id: ci.images.id, url: ci.images.url, isNew: false }))
                    .filter((img: ImageItem) => img.url)
            );
        }

        if (c.recipes) {
            setRecipeItems(
                sortRecipesByOrder(c.recipes).map((r: any) =>
                    mapPresentationRecipeToEditItem(r, { includeCocktailFields: true })
                ) as SortableRecipeItem[]
            );
        }

        supabase
            .from("items")
            .select(
                "bar_id, override_visibility_level, override_generic_ingredient_level, override_specific_brand_level, override_measurement_level, override_prep_level"
            )
            .eq("id", id)
            .single()
            .then(({ data }) => {
                if (!data) return;
                setBarId(data.bar_id);
                setOverrideVisibility(data.override_visibility_level?.toString() || null);
                setOverrideGeneric(data.override_generic_ingredient_level?.toString() || null);
                setOverrideSpecific(data.override_specific_brand_level?.toString() || null);
                setOverrideMeasurement(data.override_measurement_level?.toString() || null);
                setOverridePrep(data.override_prep_level?.toString() || null);
            });
    }, [cocktail, enabled, id]);

    const resetLoaded = useCallback(() => {
        isLoaded.current = false;
        setIsDirty(false);
    }, []);

    const discardChanges = useCallback(() => {
        resetLoaded();
    }, [resetLoaded]);

    const pickImage = async () => {
        const { status } = await FilePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            Alert.alert("Permission needed", "We need access to your photos.");
            return;
        }
        const result = await FilePicker.launchImageLibraryAsync({
            mediaTypes: FilePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 5],
            quality: 0.8,
        });
        if (!result.canceled) {
            setLocalImagesDirty((prev) => [
                ...prev,
                ...result.assets.map((asset) => ({ url: asset.uri, isNew: true })),
            ]);
        }
    };

    const uploadAndLinkImage = async (uri: string): Promise<string | null> => {
        try {
            const ext = uri.substring(uri.lastIndexOf(".") + 1);
            const fileName = `cocktails/${id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
            const arrayBuffer = decode(base64);

            const { error: uploadError } = await supabase.storage
                .from("drinks")
                .upload(fileName, arrayBuffer, { contentType: `image/${ext}`, upsert: false });
            if (uploadError) return null;

            const { data: publicUrlData } = supabase.storage.from("drinks").getPublicUrl(fileName);
            const { data: imgData, error: imgError } = await supabase
                .from("images")
                .insert({ url: publicUrlData.publicUrl })
                .select()
                .single();
            if (imgError || !imgData) return null;
            return imgData.id;
        } catch {
            return null;
        }
    };

    const handleAddPill = async (type: SpecCategory, newItemName: string) => {
        if (!newItemName.trim()) return;
        const { error } = await supabase.from("items").insert({
            name: capitalize(newItemName.trim()),
            item_type: type,
        });
        if (error) throw error;
        await queryClient.invalidateQueries({ queryKey: ["dropdowns_v2"] });
    };

    const identifyGlassware = async (imageBase64: string, mimeType: string) => {
        const { data, error } = await supabase.functions.invoke("identify-glassware", {
            body: { image_base64: imageBase64, mime_type: mimeType },
        });
        if (error) throw new Error(error.message || "Identification failed");
        if (data?.error) throw new Error(data.error);
        return {
            suggestedName: data.suggestedName as string,
            matchedIcon: (data.matchedIcon as string | null) ?? null,
            iconUrl: (data.iconUrl as string | null) ?? null,
            confidence: data.confidence as number | undefined,
        };
    };

    const handleAddGlassware = async (payload: {
        name: string;
        iconKey: string | null;
        iconUrl: string | null;
    }): Promise<string> => {
        const { data, error } = await supabase
            .from("items")
            .insert({
                name: capitalize(payload.name.trim()),
                item_type: "glassware",
                icon_key: payload.iconKey,
                icon_url: payload.iconUrl,
            })
            .select("id")
            .single();
        if (error || !data) throw error || new Error("Failed to create glassware");
        await queryClient.invalidateQueries({ queryKey: ["dropdowns_v2"] });
        setGlasswareIdDirty(data.id);
        return data.id;
    };

    const confirmDeletePill = async (field: SpecDbField, pillId: string) => {
        await supabase.from("items").update({ [field]: null }).eq(field, pillId);
        const { error } = await supabase.from("items").delete().eq("id", pillId);
        if (error) throw error;

        if (field === "method_id" && methodId === pillId) setMethodIdDirty(null);
        if (field === "glassware_id" && glasswareId === pillId) setGlasswareIdDirty(null);
        if (field === "family_id" && familyId === pillId) setFamilyIdDirty(null);
        if (field === "ice_id" && iceId === pillId) setIceIdDirty(null);

        await queryClient.invalidateQueries({ queryKey: ["dropdowns_v2"] });
    };

    const handleDeletePill = async (category: SpecCategory, item: { id: string; name: string }) => {
        const field = SPEC_DB_FIELD[category];
        try {
            const { data: affected, error } = await supabase
                .from("items")
                .select("id, name")
                .eq(field, item.id)
                .eq("item_type", "cocktail");
            if (error) throw error;

            const confirm = () => confirmDeletePill(field, item.id);
            if (affected && affected.length > 0) {
                const names = affected.map((c: any) => c.name).join(", ");
                Alert.alert(
                    "Warning",
                    `Deleting this item will remove it from ${affected.length} cocktail(s):\n\n${names}\n\nAre you sure?`,
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: confirm },
                    ]
                );
            } else {
                Alert.alert("Confirm Delete", `Delete "${item.name}"?`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: confirm },
                ]);
            }
        } catch {
            Alert.alert("Error", "Could not check affected cocktails.");
        }
    };

    const setSpecId = (category: SpecCategory, value: string | null) => {
        const setters = {
            method: setMethodIdDirty,
            glassware: setGlasswareIdDirty,
            family: setFamilyIdDirty,
            ice: setIceIdDirty,
        };
        setters[category](value);
    };

    const getSpecId = (category: SpecCategory) => {
        const ids = { method: methodId, glassware: glasswareId, family: familyId, ice: iceId };
        return ids[category];
    };

    const handleSave = async (): Promise<boolean> => {
        if (!name?.trim()) {
            Alert.alert("Missing Info", "Name is required.");
            return false;
        }

        setSaving(true);
        try {
            const finalImageIds: string[] = [];
            for (const img of localImages) {
                if (img.isNew) {
                    const newId = await uploadAndLinkImage(img.url);
                    if (!newId) throw new Error("Failed to upload image");
                    finalImageIds.push(newId);
                } else if (img.id) {
                    finalImageIds.push(img.id);
                }
            }

            await supabase.from("item_images").delete().eq("item_id", id);
            if (finalImageIds.length > 0) {
                const { error: insertError } = await supabase.from("item_images").insert(
                    finalImageIds.map((imgId, index) => ({
                        item_id: id,
                        image_id: imgId,
                        sort_order: index,
                    }))
                );
                if (insertError) throw insertError;
            }

            const { error } = await supabase
                .from("items")
                .update({
                    name: capitalize(name),
                    description,
                    origin: capitalize(origin) || null,
                    notes: notes || null,
                    glassware_id: glasswareId,
                    family_id: familyId,
                    ice_id: iceId,
                    bar_id: barId || null,
                    override_visibility_level: overrideVisibility ? parseInt(overrideVisibility) : null,
                    override_generic_ingredient_level: overrideGeneric ? parseInt(overrideGeneric) : null,
                    override_specific_brand_level: overrideSpecific ? parseInt(overrideSpecific) : null,
                    override_measurement_level: overrideMeasurement ? parseInt(overrideMeasurement) : null,
                    override_prep_level: overridePrep ? parseInt(overridePrep) : null,
                })
                .eq("id", id);
            if (error) throw error;

            const keptIds = recipeItems.map((r) => r.id).filter(Boolean);
            if (keptIds.length > 0) {
                await supabase.from("recipes").delete().eq("recipe_item_id", id).not("id", "in", `(${keptIds.join(",")})`);
            } else {
                await supabase.from("recipes").delete().eq("recipe_item_id", id);
            }

            for (const [index, item] of recipeItems.entries()) {
                const payload = {
                    recipe_item_id: id,
                    ingredient_item_id: item.ingredient_id,
                    amount: parseFloat(item.amount) || null,
                    unit: item.unit || null,
                    preparation_notes: item.preparation_notes || null,
                    is_optional: item.is_optional || false,
                    sort_order: index,
                };
                if (item.id) {
                    await supabase.from("recipes").update(payload).eq("id", item.id);
                } else {
                    await supabase.from("recipes").insert(payload);
                }
            }

            await supabase.from("item_methods").delete().eq("item_id", id);
            if (methodId) {
                await supabase.from("item_methods").insert({
                    item_id: id,
                    method_item_id: methodId,
                    sort_order: 0,
                });
            }

            await queryClient.invalidateQueries({ queryKey: ["cocktail", id] });
            await queryClient.invalidateQueries({ queryKey: ["cocktails"] });
            setIsDirty(false);
            isLoaded.current = false;
            return true;
        } catch {
            Alert.alert("Error", "Failed to update cocktail.");
            return false;
        } finally {
            setSaving(false);
        }
    };

    return {
        loading: loadingDropdowns || loadingCocktail,
        saving,
        isDirty,
        dropdowns,
        methods: dropdowns?.methods || [],
        glassware: dropdowns?.glassware || [],
        families: dropdowns?.families || [],
        iceTypes: dropdowns?.iceTypes || [],
        allIngredients: dropdowns?.ingredients || [],
        name,
        setName: setNameDirty,
        description,
        setDescription: setDescriptionDirty,
        origin,
        setOrigin: setOriginDirty,
        notes,
        setNotes: setNotesDirty,
        methodId,
        glasswareId,
        familyId,
        iceId,
        setSpecId,
        getSpecId,
        barId,
        setBarId: setBarIdDirty,
        overrideVisibility,
        setOverrideVisibility: setOverrideVisibilityDirty,
        overrideGeneric,
        setOverrideGeneric: setOverrideGenericDirty,
        overrideSpecific,
        setOverrideSpecific: setOverrideSpecificDirty,
        overrideMeasurement,
        setOverrideMeasurement: setOverrideMeasurementDirty,
        overridePrep,
        setOverridePrep: setOverridePrepDirty,
        recipeItems,
        setRecipeItems: setRecipeItemsDirty,
        localImages,
        setLocalImages: setLocalImagesDirty,
        pickImage,
        handleAddPill,
        handleAddGlassware,
        identifyGlassware,
        handleDeletePill,
        handleSave,
        resetLoaded,
        discardChanges,
    };
}
