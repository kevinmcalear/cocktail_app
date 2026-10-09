import { decode } from "base64-arraybuffer";
import * as FilePicker from "expo-image-picker";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import { useCocktail } from "@/hooks/useCocktails";
import { dropdownKeys, useDropdowns } from "@/hooks/useDropdowns";
import { identifyGlasswareFromPhoto } from "@/lib/identifyGlassware";
import { imageExtFromUri, uriToBase64 } from "@/lib/imageBase64";
import { isHeroLink } from "@/lib/itemImages";
import { plainDbMessage } from "@/lib/dbError";
import { findByName, orderedMethodIds, toggleId } from "@/lib/drinkMethods";
import { capitalize } from "@/lib/stringUtils";
import { fetchEditableRecipes } from "@/lib/editableRecipes";
import { mapPresentationRecipeToEditItem } from "@/lib/recipeUtils";
import { supabase, UPLOAD_CACHE_SECONDS } from "@/lib/supabase";
import { saveDrinkSpec } from "@/hooks/useVersions";
import type { ImageItem } from "@/components/cocktail/SortableImageList";
import { setItemImages } from "@/components/drink/drinkImages";

export type SpecCategory = "method" | "glassware" | "family" | "ice";

import type { SortableRecipeItem } from "@/components/recipe/SortableRecipeList";

export function useCocktailEditor(id: string, { enabled = true }: { enabled?: boolean } = {}) {
    const queryClient = useQueryClient();
    const { data: dropdowns, isLoading: loadingDropdowns } = useDropdowns({ ingredients: enabled });
    const { data: cocktail, isLoading: loadingCocktail } = useCocktail(enabled ? id : undefined);

    const isLoaded = useRef(false);
    const [rawLoaded, setRawLoaded] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [saving, setSaving] = useState(false);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [origin, setOrigin] = useState("");
    const [notes, setNotes] = useState("");

    const [methodIds, setMethodIds] = useState<string[]>([]);
    const [glasswareId, setGlasswareId] = useState<string | null>(null);
    const [familyId, setFamilyId] = useState<string | null>(null);
    const [iceId, setIceId] = useState<string | null>(null);
    // How its glass is drawn (lib/sketch/geometry.ts GLASS_VARIANTS); null is the bar's glass or the default.
    const [sketchVariant, setSketchVariant] = useState<string | null>(null);

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
    const setMethodIdsDirty = wrap(setMethodIds);
    const setGlasswareIdDirty = wrap(setGlasswareId);
    const setFamilyIdDirty = wrap(setFamilyId);
    const setIceIdDirty = wrap(setIceId);
    const setSketchVariantDirty = wrap(setSketchVariant);
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
        setMethodIds(orderedMethodIds(c.item_methods));
        setGlasswareId(c.glassware_id);
        setFamilyId(c.family_id);
        setIceId(c.ice_id);

        if (c.item_images) {
            // Service photos (side, top, ...) are managed on the drink page, not here.
            const sorted = c.item_images.filter(isHeroLink).sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
            setLocalImages(
                sorted
                    .map((ci: any) => ({ id: ci.images?.id, url: ci.images?.url, isNew: false }))
                    .filter((img: ImageItem) => img.url)
            );
        }

        // Recipe rows and bar settings come from the raw tables, not the role-masked
        // presentation views: a save writes every field back, so masked values
        // would overwrite real ones. Saving waits until both have loaded.
        setRawLoaded(false);
        Promise.all([
            fetchEditableRecipes(id),
            supabase
                .from("items")
                .select(
                    "bar_id, sketch_variant, override_visibility_level, override_generic_ingredient_level, override_specific_brand_level, override_measurement_level, override_prep_level"
                )
                .eq("id", id)
                .single(),
        ])
            .then(([recipes, { data, error }]) => {
                if (error || !data) throw error ?? new Error("Cocktail not found");
                setRecipeItems(
                    recipes.map((r: any) =>
                        mapPresentationRecipeToEditItem(r, { includeCocktailFields: true })
                    ) as SortableRecipeItem[]
                );
                setBarId(data.bar_id);
                setSketchVariant(data.sketch_variant ?? null);
                setOverrideVisibility(data.override_visibility_level?.toString() || null);
                setOverrideGeneric(data.override_generic_ingredient_level?.toString() || null);
                setOverrideSpecific(data.override_specific_brand_level?.toString() || null);
                setOverrideMeasurement(data.override_measurement_level?.toString() || null);
                setOverridePrep(data.override_prep_level?.toString() || null);
                setRawLoaded(true);
            })
            .catch(() => {
                Alert.alert("Error", "Could not load this cocktail for editing.");
            });
    }, [cocktail, enabled, id]);

    const resetLoaded = useCallback(() => {
        isLoaded.current = false;
        setIsDirty(false);
    }, []);

    const discardChanges = useCallback(() => {
        resetLoaded();
    }, [resetLoaded]);

    const addImages = useCallback((uris: string[]) => {
        if (!uris.length) return;
        setLocalImagesDirty((prev) => [...prev, ...uris.map((url) => ({ url, isNew: true }))]);
    }, []);

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
            addImages(result.assets.map((asset) => asset.uri));
        }
    };

    const uploadAndLinkImage = async (uri: string): Promise<string | null> => {
        try {
            const ext = imageExtFromUri(uri);
            const fileName = `cocktails/${id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
            const base64 = await uriToBase64(uri);
            const arrayBuffer = decode(base64);

            const { error: uploadError } = await supabase.storage
                .from("drinks")
                .upload(fileName, arrayBuffer, {
                    contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
                    upsert: false,
                    cacheControl: UPLOAD_CACHE_SECONDS,
                });
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

    /** Finds or creates a shared method, glass, family or ice by name. The picker selects the id it returns. */
    const handleAddPill = async (type: SpecCategory, newItemName: string): Promise<string> => {
        if (!newItemName.trim()) throw new Error("Name is required");
        const lists = { method: "methods", glassware: "glassware", family: "families", ice: "iceTypes" } as const;
        let newId = findByName(dropdowns?.[lists[type]] ?? [], newItemName)?.id;
        if (!newId) {
            const { data, error } = await supabase
                .from("items")
                .insert({
                    name: capitalize(newItemName.trim()),
                    item_type: type,
                })
                .select("id")
                .single();
            if (error || !data) throw error || new Error(`Failed to create ${type}`);
            await queryClient.invalidateQueries({ queryKey: dropdownKeys.specs });
            newId = data.id;
        }
        return newId;
    };

    const identifyGlassware = identifyGlasswareFromPhoto;

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
        await queryClient.invalidateQueries({ queryKey: dropdownKeys.specs });
        setGlasswareIdDirty(data.id);
        return data.id;
    };

    function setSpecId(category: SpecCategory, value: string | null) {
        const setters = {
            method: (id: string | null) => setMethodIdsDirty(id ? [id] : []),
            glassware: setGlasswareIdDirty,
            family: setFamilyIdDirty,
            ice: setIceIdDirty,
        };
        setters[category](value);
    }

    const getSpecId = (category: SpecCategory) => {
        const ids = { method: methodIds[0] ?? null, glassware: glasswareId, family: familyId, ice: iceId };
        return ids[category];
    };

    /** Adds a method to this drink, or takes it off. Never touches the method itself. */
    const toggleMethod = (methodItemId: string) => setMethodIdsDirty((prev) => toggleId(prev, methodItemId));

    const handleSave = async (): Promise<boolean> => {
        if (!rawLoaded) {
            Alert.alert("Still loading", "Wait for the recipe to finish loading, then save again.");
            return false;
        }
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

            await setItemImages(id, finalImageIds, { replace: true });

            const { error } = await supabase
                .from("items")
                .update({
                    name: capitalize(name),
                    description,
                    origin: capitalize(origin) || null,
                    // '' clears; null would keep a bar-credited drink's notes (credited_drink_notes).
                    notes: notes.trim() ? notes : '',
                    glassware_id: glasswareId,
                    family_id: familyId,
                    ice_id: iceId,
                    sketch_variant: sketchVariant,
                    bar_id: barId || null,
                    override_visibility_level: overrideVisibility ? parseInt(overrideVisibility) : null,
                    override_generic_ingredient_level: overrideGeneric ? parseInt(overrideGeneric) : null,
                    override_specific_brand_level: overrideSpecific ? parseInt(overrideSpecific) : null,
                    override_measurement_level: overrideMeasurement ? parseInt(overrideMeasurement) : null,
                    override_prep_level: overridePrep ? parseInt(overridePrep) : null,
                })
                .eq("id", id);
            if (error) throw error;

            // Lines and method go through save_drink_spec: one transaction, and a
            // version of the spec written with it (History on the drink page).
            await saveDrinkSpec(
                id,
                recipeItems.map((item) => ({
                    id: item.id ?? null,
                    ingredient_item_id: item.ingredient_id,
                    amount: parseFloat(item.amount) || null,
                    unit: item.unit || null,
                    preparation_notes: item.preparation_notes || null,
                    is_optional: item.is_optional || false,
                })),
                methodIds,
                null
            );

            await queryClient.invalidateQueries({ queryKey: ["cocktail", id] });
            await queryClient.invalidateQueries({ queryKey: ["cocktails"] });
            // The database redraws it in the chosen glass as the row saves.
            await queryClient.invalidateQueries({ queryKey: ["item-sketch", id] });
            setIsDirty(false);
            isLoaded.current = false;
            return true;
        } catch (error) {
            Alert.alert("Error", plainDbMessage(error) ?? "Failed to update cocktail.");
            return false;
        } finally {
            setSaving(false);
        }
    };

    return {
        loading: loadingDropdowns || loadingCocktail || (enabled && !rawLoaded),
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
        methodIds,
        toggleMethod,
        glasswareId,
        familyId,
        iceId,
        sketchVariant,
        setSketchVariant: setSketchVariantDirty,
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
        addImages,
        pickImage,
        handleAddPill,
        handleAddGlassware,
        identifyGlassware,
        handleSave,
        resetLoaded,
        discardChanges,
    };
}
